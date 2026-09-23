# Terraform — Local Deployment

No Terraform is needed for the local deployment. The project's real, permanent
deployment target is a local **kind** cluster with **Calico** CNI, provisioned
by the shell script `scripts/setup-kind-cluster.sh`.

Terraform modules under `terraform/optional-aws/` are provided as evidence of
Infrastructure as Code competency. They are written, validated (`terraform
validate`), formatted (`terraform fmt`), and planned (`terraform plan`) — but
**never applied** unless the Optional Phase A cloud extension is explicitly
activated.

See [ADR-0001](../../docs/adr/0001-technology-choices.md) for the rationale
behind choosing kind over managed Kubernetes services.
