#!/usr/bin/env bash

set -euo pipefail

unset DOCKER_HOST
docker context use default >/dev/null 2>&1 || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

MANAGER_HOST="tcp://127.0.0.1:23751"
WORKER1_HOST="tcp://127.0.0.1:23752"
WORKER2_HOST="tcp://127.0.0.1:23753"

remove_stack() {
  local stack_name="$1"

  echo "Șterg stack-ul '${stack_name}'..."
  docker -H "${MANAGER_HOST}" stack rm "${stack_name}" || true
}

echo "Oprire stack-uri din cluster..."
if docker -H "${MANAGER_HOST}" stack ls >/dev/null 2>&1; then
  mapfile -t STACKS < <(docker -H "${MANAGER_HOST}" stack ls --format '{{.Name}}')

  if [[ ${#STACKS[@]} -gt 0 ]]; then
    for stack_name in "${STACKS[@]}"; do
      remove_stack "${stack_name}"
    done

    echo "Aștept oprirea task-urilor..."
    sleep 8
  else
    echo "Nu există stack-uri active în manager."
  fi
else
  echo "Managerul Swarm nu este disponibil. Trec direct la opțiunile locale."
fi

echo
read -p "Vrei să fie șterse și volumele swarm-lab? (y/n) " -n 1 -r
echo
DELETE_VOLUMES="n"
if [[ $REPLY =~ ^[Yy]$ ]]; then
  DELETE_VOLUMES="y"
fi

echo
read -p "Vrei să opresc și containerele swarm-manager / workeri? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Scot workerii din swarm..."
  docker -H "${WORKER1_HOST}" swarm leave --force 2>/dev/null || true
  docker -H "${WORKER2_HOST}" swarm leave --force 2>/dev/null || true

  echo "Scot managerul din swarm..."
  docker -H "${MANAGER_HOST}" swarm leave --force 2>/dev/null || true

  if [[ "${DELETE_VOLUMES}" == "y" ]]; then
    echo "Opresc containerele și șterg volumele swarm-lab..."
    docker compose -f "${SCRIPT_DIR}/docker-compose.yml" down -v --remove-orphans
  else
    echo "Opresc containerele, dar păstrez volumele swarm-lab..."
    docker compose -f "${SCRIPT_DIR}/docker-compose.yml" down --remove-orphans
  fi

  echo "Șterg containere rămase, dacă există..."
  docker rm -f swarm-manager swarm-worker-1 swarm-worker-2 2>/dev/null || true

  if [[ "${DELETE_VOLUMES}" == "y" ]]; then
    echo "Șterg volume rămase din swarm-lab, dacă există..."
    docker volume ls -q | grep '^swarm-lab_' | xargs -r docker volume rm
  fi

  echo
  echo "Containerele swarm-lab au fost oprite."
  echo "Pentru a reporni:"
  echo "  cd ${SCRIPT_DIR}"
  echo "  ./setup-swarm.sh"
else
  if [[ "${DELETE_VOLUMES}" == "y" ]]; then
    echo "Volumele nu pot fi șterse cât timp containerele swarm-lab rămân pornite."
    echo "Rulează din nou scriptul și alege oprirea containerelor dacă vrei și ștergerea volumelor."
  else
    echo "Clusterul rămâne pornit, dar stack-urile au fost oprite."
    echo "Poți redeploy cu:"
    echo "  export DOCKER_HOST=${MANAGER_HOST}"
    echo "  cd ${INFRA_DIR}"
    echo "  docker stack deploy -c docker-stack.yml shopping"
  fi
fi

echo
echo "Verificare containere swarm:"
docker ps -a | grep swarm || true

echo
echo "Verificare volume swarm-lab:"
docker volume ls | grep swarm-lab || true
