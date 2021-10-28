import "@polymer/polymer";

const styleElement = document.createElement("dom-module");
styleElement.innerHTML = `<link rel="import" href="responsive.html">`;
styleElement.register("vi-responsive-style-module");