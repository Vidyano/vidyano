FROM mcr.microsoft.com/devcontainers/dotnet:1-8.0-bookworm

# Node.js installation for vscode user
RUN su vscode -c "source /usr/local/share/nvm/nvm.sh && nvm install --lts && nvm use --lts && npm install -g typescript" 2>&1

USER vscode