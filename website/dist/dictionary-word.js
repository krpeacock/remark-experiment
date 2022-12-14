export class DictionaryWord extends HTMLElement {
    constructor() {
        super();
        const template = document.getElementById("dictionary-word-template");
        const shadow = this.attachShadow({ mode: "open" });
        shadow.appendChild(template.content.cloneNode(true));
    }
}
