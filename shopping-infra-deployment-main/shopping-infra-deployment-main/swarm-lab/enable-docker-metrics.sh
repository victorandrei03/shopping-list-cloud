#!/usr/bin/env bash

set -euo pipefail

unset DOCKER_HOST

docker exec swarm-manager sh -c 'mkdir -p /etc/docker && echo "{\"metrics-addr\":\"0.0.0.0:9323\",\"experimental\":true}" > /etc/docker/daemon.json'
docker exec swarm-worker-1 sh -c 'mkdir -p /etc/docker && echo "{\"metrics-addr\":\"0.0.0.0:9323\",\"experimental\":true}" > /etc/docker/daemon.json'
docker exec swarm-worker-2 sh -c 'mkdir -p /etc/docker && echo "{\"metrics-addr\":\"0.0.0.0:9323\",\"experimental\":true}" > /etc/docker/daemon.json'

echo "Metricile Docker au fost activate pe toate nodurile swarm dind."
