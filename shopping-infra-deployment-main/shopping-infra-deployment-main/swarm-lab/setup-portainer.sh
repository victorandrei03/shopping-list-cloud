#!/bin/bash
export DOCKER_HOST=tcp://127.0.0.1:23751

echo "--- Verificare conexiune la Cluster Swarm (Manager) ---"
if ! docker node ls > /dev/null 2>&1; then
    echo "EROARE: Nu s-a putut contacta Managerul Swarm pe $DOCKER_HOST."
    echo "Asigură-te că ./setup-swarm.sh a rulat cu succes și containerele sunt 'Up'."
    exit 1
fi
echo "Conexiune stabilită cu succes."

echo "--- Gestionare fișier stack Portainer ---"
FILE=portainer-agent-stack.yml

if [ -f "$FILE" ]; then
    echo "Fișierul $FILE există deja. Sar peste descărcare."
else
    echo "Descărcare fișier stack Portainer..."
    curl -L https://downloads.portainer.io/ce2-19/portainer-agent-stack.yml -o $FILE
    # Aplicăm modificarea portului doar la prima descărcare
    echo "Modificare port 8000 -> 8001 (pentru a evita conflictul cu Kong)..."
    sed -i 's/"8000:8000"/"8001:8000"/g' $FILE
fi

echo "--- Lansare/Actualizare Portainer în Cluster ---"
docker stack deploy -c $FILE portainer

echo "--- Verificare status servicii ---"
sleep 2
docker service ls --filter name=portainer

echo "--------------------------------------------------------"
echo "Portainer este gata de utilizare!"
echo "Adresă: https://localhost:9443"
echo "--------------------------------------------------------"