ARG VARIANT="6.0-bullseye-slim"
FROM mcr.microsoft.com/vscode/devcontainers/dotnet:0-${VARIANT}

# Switch to root for system-level installations
USER root

# Install Microsoft package repository
RUN wget https://packages.microsoft.com/config/debian/11/packages-microsoft-prod.deb -O packages-microsoft-prod.deb && \
    dpkg -i packages-microsoft-prod.deb && \
    rm packages-microsoft-prod.deb

# Install system dependencies
RUN apt-get update && \
  apt-get install -y apt-transport-https bzip2 wget && \
  apt-get update && \
  apt-get install -y aspnetcore-runtime-6.0 && \
  rm -rf /var/lib/apt/lists/*

# Node.js installation for vscode user
ARG NODE_VERSION="17"
RUN if [ "${NODE_VERSION}" != "none" ]; then \
    su vscode -c "umask 0002 && . /usr/local/share/nvm/nvm.sh && nvm install ${NODE_VERSION} 2>&1 && nvm alias default ${NODE_VERSION}"; \
    fi

# RavenDB Installation
ARG RAVENDB_VERSION_MAJOR_MINOR="5.4"
ENV RAVENDB_INSTALL_DIR="/opt/ravendb_server"
ENV RAVENDB_DOWNLOAD_URL="https://hibernatingrhinos.com/downloads/RavenDB%20for%20Linux%20x64/${RAVENDB_VERSION_MAJOR_MINOR}"

RUN echo "Installing RavenDB ${RAVENDB_VERSION_MAJOR_MINOR}..." && \
    mkdir -p ${RAVENDB_INSTALL_DIR} && \
    cd ${RAVENDB_INSTALL_DIR} && \
    echo "Downloading RavenDB from ${RAVENDB_DOWNLOAD_URL}..." && \
    wget --progress=bar:force -O ravendb.tar.bz2 "${RAVENDB_DOWNLOAD_URL}" && \
    echo "Extracting RavenDB..." && \
    tar -xjvf ravendb.tar.bz2 --strip-components=1 && \
    rm ravendb.tar.bz2 && \
    chown -R vscode:vscode ${RAVENDB_INSTALL_DIR} && \
    echo "RavenDB installed in ${RAVENDB_INSTALL_DIR} and owned by vscode"

# Create a wrapper script for starting RavenDB
# This script will be run by the 'vscode' user later in postCreateCommand
# So, paths like /home/vscode/ will resolve correctly to the vscode user's home
RUN echo '#!/bin/bash' > /usr/local/bin/start-ravendb.sh && \
    echo 'echo "Creating RavenDB data and log directories..."' >> /usr/local/bin/start-ravendb.sh && \
    echo 'mkdir -p /home/vscode/ravendb_data /home/vscode/ravendb_logs' >> /usr/local/bin/start-ravendb.sh && \
    echo 'echo "Starting RavenDB Server on port 8081 in UNSECURED mode (PrivateNetwork access) in background..."' >> /usr/local/bin/start-ravendb.sh && \
    echo "nohup ${RAVENDB_INSTALL_DIR}/Server/Raven.Server \\" >> /usr/local/bin/start-ravendb.sh && \
    echo "    --Setup.Mode=None \\" >> /usr/local/bin/start-ravendb.sh && \
    echo "    --License.Eula.Accepted=true \\" >> /usr/local/bin/start-ravendb.sh && \
    echo "    --DataDir=/home/vscode/ravendb_data \\" >> /usr/local/bin/start-ravendb.sh && \
    echo "    --Logs.Path=/home/vscode/ravendb_logs/logs \\" >> /usr/local/bin/start-ravendb.sh && \
    echo "    --ServerUrl=http://0.0.0.0:8081 \\" >> /usr/local/bin/start-ravendb.sh && \
    echo "    --PublicServerUrl=http://localhost:8081 \\" >> /usr/local/bin/start-ravendb.sh && \
    echo "    --Security.UnsecuredAccessAllowed=PublicNetwork \\" >> /usr/local/bin/start-ravendb.sh && \
    echo "    > /home/vscode/ravendb_startup.log 2>&1 &" >> /usr/local/bin/start-ravendb.sh && \
    echo 'echo "RavenDB server (unsecured - PrivateNetwork) process initiated on port 8081. Startup log: /home/vscode/ravendb_startup.log"' >> /usr/local/bin/start-ravendb.sh && \
    chmod +x /usr/local/bin/start-ravendb.sh

# Switch to vscode user for subsequent commands and as the default user
USER vscode

# Install global npm packages as vscode user
RUN npm install -g typescript