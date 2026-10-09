#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# scripts/setup-kind-cluster.sh — Kind + Calico Cluster Provisioner
# Purpose: Creates a 3-node Kubernetes 1.31 cluster with default
#          CNI disabled, installs Calico CNI, installs ingress-nginx,
#          and verifies NetworkPolicy enforcement live.
#
# Architectural Context:
#   kindnet (default kind CNI) DOES NOT enforce NetworkPolicies.
#   Calico CNI is mandatory to provide true network segmentation,
#   default-deny policies, and tenant isolation in Phase 14.
#
# Zero-Cost: Runs entirely on local Docker engine (no cloud spend).
# ──────────────────────────────────────────────────────────────

set -euo pipefail

CLUSTER_NAME="secure-cluster"
K8S_VERSION="v1.31.2"
CALICO_VERSION="v3.28.2"

echo "=== [Step 1/5] Verifying Prerequisites ==="
for cmd in docker kind kubectl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: Required tool '$cmd' is not installed or not in PATH."
    exit 1
  fi
done
echo "Docker, kind, and kubectl are available."

# Check if kind cluster already exists
if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
  echo "Cluster '${CLUSTER_NAME}' already exists."
  echo "Current cluster nodes:"
  kubectl get nodes -o wide
else
  echo "=== [Step 2/5] Creating 3-Node kind Cluster (Default CNI Disabled) ==="
  cat <<EOF | kind create cluster --name "${CLUSTER_NAME}" --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  disableDefaultCNI: true          # Disable kindnet so Calico CNI can manage networking
  podSubnet: "192.168.0.0/16"      # Standard CIDR matching Calico IPAM
nodes:
  - role: control-plane
    image: kindest/node:${K8S_VERSION}
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 443
        hostPort: 443
        protocol: TCP
  - role: worker
    image: kindest/node:${K8S_VERSION}
  - role: worker
    image: kindest/node:${K8S_VERSION}
EOF
fi

echo "=== Configuring Local Registry Access in Cluster Nodes ==="
if [ "$(docker inspect -f '{{.State.Running}}' "kind-registry" 2>/dev/null)" != "true" ]; then
  docker run -d --restart=always -p 5001:5000 --network kind --name kind-registry registry:2 2>/dev/null || docker start kind-registry
fi
docker network connect "kind" "kind-registry" 2>/dev/null || true

for node in $(kind get nodes --name "${CLUSTER_NAME}"); do
  docker exec "$node" mkdir -p "/etc/containerd/certs.d/kind-registry:5000"
  docker exec -i "$node" tee "/etc/containerd/certs.d/kind-registry:5000/hosts.toml" >/dev/null <<EOF
server = "http://kind-registry:5000"

[host."http://kind-registry:5000"]
  capabilities = ["pull", "resolve"]
  skip_verify = true
EOF
  docker exec -i "$node" bash -c '
if ! grep -q "config_path" /etc/containerd/config.toml; then
cat <<EOC >> /etc/containerd/config.toml
[plugins."io.containerd.grpc.v1.cri".registry]
  config_path = "/etc/containerd/certs.d"
EOC
systemctl restart containerd
fi
'
done
echo "Local registry config applied to all nodes."

echo "=== [Step 3/5] Installing Calico CNI (${CALICO_VERSION}) ==="
kubectl apply -f "https://raw.githubusercontent.com/projectcalico/calico/${CALICO_VERSION}/manifests/calico.yaml"

# Explicitly tell Calico to use eth0 for BGP peering in kind multi-node clusters
kubectl -n kube-system set env daemonset/calico-node IP_AUTODETECTION_METHOD=interface=eth0

echo "Waiting for Calico daemonset to be rolled out across all 3 nodes..."
kubectl rollout status daemonset/calico-node -n kube-system --timeout=180s

echo "Waiting for Calico controllers deployment..."
kubectl rollout status deployment/calico-kube-controllers -n kube-system --timeout=180s

echo "Waiting for all nodes to become Ready..."
kubectl wait --for=condition=Ready nodes --all --timeout=120s
kubectl get nodes -o wide

echo "=== [Step 4/5] Installing Ingress Nginx for kind ==="
kubectl apply -f "https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml"

# Ensure controller schedules on control-plane where ports 80/443 are forwarded
kubectl patch deployment ingress-nginx-controller -n ingress-nginx \
  -p '{"spec":{"template":{"spec":{"nodeSelector":{"ingress-ready":"true"}}}}}'

echo "Waiting for ingress-nginx controller to be ready..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=180s

echo "=== [Step 5/5] Verifying NetworkPolicy Enforcement (Calico) ==="
TEST_NS="calico-netpol-verify"
kubectl delete namespace "${TEST_NS}" --ignore-not-found=true >/dev/null 2>&1
kubectl create namespace "${TEST_NS}"

# 1. Run a test web server pod
kubectl run test-target --namespace="${TEST_NS}" \
  --image=nginx:alpine \
  --labels="app=test-target" \
  --port=80 \
  --restart=Never

kubectl wait --namespace="${TEST_NS}" --for=condition=ready pod/test-target --timeout=60s

TARGET_IP=$(kubectl get pod test-target -n "${TEST_NS}" -o jsonpath='{.status.podIP}')
echo "Target pod running at IP: ${TARGET_IP}"

# 2. Run client probe before policy (MUST succeed)
echo "Checking baseline connectivity (before NetworkPolicy)..."
BEFORE_RESULT=$(kubectl run test-client-before --namespace="${TEST_NS}" \
  --image=curlimages/curl:8.10.1 \
  --restart=Never --rm -i --quiet -- \
  curl -s -m 5 -o /dev/null -w "%{http_code}" "http://${TARGET_IP}:80" || true)

if [ "${BEFORE_RESULT}" != "200" ]; then
  echo "ERROR: Baseline connection failed before NetworkPolicy. HTTP code: ${BEFORE_RESULT}"
  kubectl delete namespace "${TEST_NS}"
  exit 1
fi
echo "Baseline connectivity verified (HTTP 200)."

# 3. Apply Default-Deny Ingress NetworkPolicy
echo "Applying Default-Deny Ingress NetworkPolicy..."
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: ${TEST_NS}
spec:
  podSelector: {}
  policyTypes:
    - Ingress
EOF

# 4. Run client probe after policy (MUST fail/timeout)
echo "Probing target pod with Default-Deny policy active (MUST be blocked)..."
AFTER_RESULT=$(kubectl run test-client-after --namespace="${TEST_NS}" \
  --image=curlimages/curl:8.10.1 \
  --restart=Never --rm -i --quiet -- \
  curl -s -m 4 -o /dev/null -w "%{http_code}" "http://${TARGET_IP}:80" || echo "BLOCKED")

if [ "${AFTER_RESULT}" = "200" ]; then
  echo "ERROR: NetworkPolicy was NOT enforced! Traffic was allowed through."
  kubectl delete namespace "${TEST_NS}"
  exit 1
fi

echo "Traffic blocked successfully: NetworkPolicy enforcement is LIVE and ACTIVE via Calico CNI."

# Cleanup verification namespace
kubectl delete namespace "${TEST_NS}" >/dev/null 2>&1

echo ""
echo "=========================================================="
echo " Kind + Calico Cluster Setup Complete & Verified! "
echo " - Cluster Name: ${CLUSTER_NAME}"
echo " - Nodes: 3 (1 control-plane, 2 workers)"
echo " - CNI: Calico (${CALICO_VERSION}) [NetworkPolicy ENFORCED]"
echo " - Ingress: ingress-nginx (ports 80/443 mapped to host)"
echo "=========================================================="
