import "@polymer/polymer";

const styleElement = document.createElement("dom-module");
styleElement.innerHTML = `<link rel="import" href="sensitive.html">`;
styleElement.register("vi-sensitive-style-module");