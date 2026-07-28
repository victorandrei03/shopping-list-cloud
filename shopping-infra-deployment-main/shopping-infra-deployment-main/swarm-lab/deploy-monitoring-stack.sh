#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMETHEUS_CONFIG="${SCRIPT_DIR}/prometheus.yml"
MANAGER_HOST="tcp://127.0.0.1:23751"

get_node_ip() {
  local node_name="$1"
  docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${node_name}"
}

unset DOCKER_HOST

MANAGER_IP="$(get_node_ip swarm-manager)"
WORKER1_IP="$(get_node_ip swarm-worker-1)"
WORKER2_IP="$(get_node_ip swarm-worker-2)"

if [ -z "${MANAGER_IP}" ] || [ -z "${WORKER1_IP}" ] || [ -z "${WORKER2_IP}" ]; then
  echo "Nu am putut determina IP-urile pentru nodurile swarm dind." >&2
  exit 1
fi

cat > "${PROMETHEUS_CONFIG}" <<EOF
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: "docker-swarm-nodes"
    static_configs:
      - targets:
          - "${MANAGER_IP}:9323"
          - "${WORKER1_IP}:9323"
          - "${WORKER2_IP}:9323"
EOF

echo "prometheus.yml regenerat cu IP-urile curente:"
cat "${PROMETHEUS_CONFIG}"

docker cp "${PROMETHEUS_CONFIG}" swarm-manager:/etc/prometheus.yml

export DOCKER_HOST="${MANAGER_HOST}"
docker stack deploy -c "${SCRIPT_DIR}/monitoring-stack.yml" monitoring
docker service ls | grep monitoring || true
