#!/usr/bin/env bash

set -euo pipefail

unset DOCKER_HOST
docker context use default >/dev/null 2>&1 || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

wait_for_docker() {
  local host="$1"
  local attempts=0

  until docker -H "${host}" info >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "${attempts}" -ge 60 ]; then
      echo "Docker daemon ${host} nu a devenit disponibil in timp util." >&2
      exit 1
    fi
    sleep 1
  done
}

echo "Pornesc nodurile dind..."
docker compose -f "${SCRIPT_DIR}/docker-compose.yml" up -d

echo "Astept daemon-ele Docker..."
wait_for_docker "tcp://127.0.0.1:23751"
wait_for_docker "tcp://127.0.0.1:23752"
wait_for_docker "tcp://127.0.0.1:23753"

MANAGER_HOST="tcp://127.0.0.1:23751"
WORKER1_HOST="tcp://127.0.0.1:23752"
WORKER2_HOST="tcp://127.0.0.1:23753"
MANAGER_ADVERTISE_ADDR="$(
  docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' swarm-manager
)"

if [ -z "${MANAGER_ADVERTISE_ADDR}" ]; then
  echo "Nu am putut determina IP-ul intern al containerului swarm-manager." >&2
  exit 1
fi

if ! docker -H "${MANAGER_HOST}" info --format '{{.Swarm.LocalNodeState}}' | grep -q '^active$'; then
  echo "Initializare swarm pe manager..."
  docker -H "${MANAGER_HOST}" swarm init --advertise-addr "${MANAGER_ADVERTISE_ADDR}"
else
  echo "Managerul este deja in swarm."
fi

WORKER_TOKEN="$(docker -H "${MANAGER_HOST}" swarm join-token -q worker)"

join_worker() {
  local host="$1"
  local name="$2"

  local state
  state="$(docker -H "${host}" info --format '{{.Swarm.LocalNodeState}}')"
  if [ "${state}" = "active" ]; then
    echo "${name} este deja in swarm."
    return
  fi

  echo "Adaug ${name} in swarm..."
  docker -H "${host}" swarm join --token "${WORKER_TOKEN}" "${MANAGER_ADVERTISE_ADDR}:2377"
}

join_worker "${WORKER1_HOST}" "swarm-worker-1"
join_worker "${WORKER2_HOST}" "swarm-worker-2"

echo
echo "Clusterul este pregatit."
echo
echo "Verificare noduri:"
docker -H "${MANAGER_HOST}" node ls
echo
echo "Pentru deploy-ul aplicatiei:"
echo "  export DOCKER_HOST=${MANAGER_HOST}"
echo "  cd ${INFRA_DIR}"
echo "  docker stack deploy -c docker-stack.yml shopping"
echo
echo "Dupa deploy:"
echo "  docker service ls"
echo "  docker stack services shopping"
echo "  docker stack ps shopping"
