# Vidyano web client

## Setup

* Launch VS Code
* Open the Command Palette (*Ctrl+Shift+P*) and select **Open Folder in Container**

## Build

* Start de Vidyano backend .NET service using **dotnet run**

* Run Build Task (*Ctrl+Shift+B*) and select **tsc: watch - tsconfig.json**
* Open the Command Palette (*Ctrl+Shift+P*) and select **Live Sass: Watch Sass**

* In a new terminal window, run **npm run dev**

## Testing

This project has multiple endpoints:
| Endpoint      | Description  |
| ------------- |--------------|
| localhost:5000        | Vidyano website using Web3 |
| localhost:5000/legacy | Vidyano website using Web2 |
| localhost:8081        | RavenDB Studio             |
