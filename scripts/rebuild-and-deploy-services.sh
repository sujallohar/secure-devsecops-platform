#!/bin/bash
set -euo pipefail

echo "=== Building, Pushing, and Signing Microservices ==="
SERVICES=("api-gateway" "user-service" "product-service" "order-service")

for svc in "${SERVICES[@]}"; do
  echo "--- Processing ${svc} ---"
  docker build -t "localhost:5001/${svc}:latest" "src/${svc}"
  docker push "localhost:5001/${svc}:latest"
  COSIGN_PASSWORD="" cosign sign --yes \
    --key security/cosign/cosign.key \
    --signing-config security/cosign/no-tlog-config.json \
    "localhost:5001/${svc}:latest"
  
  DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' "localhost:5001/${svc}:latest" | awk -F'@' '{print $2}')
  echo "DIGEST_${svc}=${DIGEST}"
done

echo "=== All services built, pushed, and signed! ==="
