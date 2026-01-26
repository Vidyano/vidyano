FROM mcr.microsoft.com/devcontainers/dotnet:dev-10.0

# Remove Yarn apt repo with expired GPG key (Yarn is available via corepack anyway)
RUN rm -f /etc/apt/sources.list.d/yarn.list

# Install act (run GitHub Actions locally)
RUN curl -sSfL https://raw.githubusercontent.com/nektos/act/master/install.sh | sh -s -- -b /usr/local/bin

# Node.js installation for vscode user
RUN su vscode -c "source /usr/local/share/nvm/nvm.sh && nvm install --lts && nvm use --lts && npm install -g typescript" 2>&1

USER vscode