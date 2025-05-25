# Stage used to provide RavenDB binaries
FROM ravendb/ravendb:5.4-latest AS raven-source
FROM mcr.microsoft.com/devcontainers/dotnet:1-8.0-bookworm

# Node.js installation for vscode user
RUN su vscode -c "source /usr/local/share/nvm/nvm.sh && nvm install --lts && nvm use --lts && npm install -g typescript" 2>&1

# RavenDB Installation
ENV RAVENDB_INSTALL_DIR="/opt/ravendb_server"

# Copy RavenDB files from the official container image
COPY --from=raven-source /opt/RavenDB ${RAVENDB_INSTALL_DIR}

RUN chown -R vscode:vscode ${RAVENDB_INSTALL_DIR} && \
    echo "RavenDB copied from ravendb/ravendb:5.4-latest to ${RAVENDB_INSTALL_DIR}"

# Create a wrapper script for starting RavenDB
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

USER vscode