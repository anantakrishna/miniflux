/*jshint esversion: 6 */
(function() {
'use strict';

class KeyboardHandler {
    constructor() {
        this.queue = [];
        this.shortcuts = {};
    }

    on(combination, callback) {
        this.shortcuts[combination] = callback;
    }

    listen() {
        document.onkeydown = (event) => {
            if (this.isEventIgnored(event)) {
                return;
            }

            let key = this.getKey(event);
            this.queue.push(key);

            for (let combination in this.shortcuts) {
                let keys = combination.split(" ");

                if (keys.every((value, index) => value === this.queue[index])) {
                    this.queue = [];
                    this.shortcuts[combination]();
                    return;
                }

                if (keys.length === 1 && key === keys[0]) {
                    this.queue = [];
                    this.shortcuts[combination]();
                    return;
                }
            }

            if (this.queue.length >= 2) {
                this.queue = [];
            }
        };
    }

    isEventIgnored(event) {
        return event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA";
    }

    getKey(event) {
        const mapping = {
            'Esc': 'Escape',
            'Up': 'ArrowUp',
            'Down': 'ArrowDown',
            'Left': 'ArrowLeft',
            'Right': 'ArrowRight'
        };

        for (let key in mapping) {
            if (mapping.hasOwnProperty(key) && key === event.key) {
                return mapping[key];
            }
        }

        return event.key;
    }
}

class FormHandler {
    static handleSubmitButtons() {
        let elements = document.querySelectorAll("form");
        elements.forEach(function (element) {
            element.onsubmit = function () {
                let button = document.querySelector("button");

                if (button) {
                    button.innerHTML = button.dataset.labelLoading;
                    button.disabled = true;
                }
            };
        });
    }
}

class MouseHandler {
    onClick(selector, callback) {
        let elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
            element.onclick = (event) => {
                event.preventDefault();
                callback(event);
            };
        });
    }
}

class App {
    run() {
        FormHandler.handleSubmitButtons();

        let keyboardHandler = new KeyboardHandler();
        keyboardHandler.on("g u", () => this.goToPage("unread"));
        keyboardHandler.on("g h", () => this.goToPage("history"));
        keyboardHandler.on("g f", () => this.goToPage("feeds"));
        keyboardHandler.on("g c", () => this.goToPage("categories"));
        keyboardHandler.on("g s", () => this.goToPage("settings"));
        keyboardHandler.on("ArrowLeft", () => this.goToPrevious());
        keyboardHandler.on("ArrowRight", () => this.goToNext());
        keyboardHandler.on("j", () => this.goToPrevious());
        keyboardHandler.on("p", () => this.goToPrevious());
        keyboardHandler.on("k", () => this.goToNext());
        keyboardHandler.on("n", () => this.goToNext());
        keyboardHandler.on("h", () => this.goToPage("previous"));
        keyboardHandler.on("l", () => this.goToPage("next"));
        keyboardHandler.on("o", () => this.openSelectedItem());
        keyboardHandler.on("v", () => this.openOriginalLink());
        keyboardHandler.on("m", () => this.toggleEntryStatus());
        keyboardHandler.on("A", () => this.markPageAsRead());
        keyboardHandler.listen();

        let mouseHandler = new MouseHandler();
        mouseHandler.onClick("a[data-on-click=markPageAsRead]", () => this.markPageAsRead());
        mouseHandler.onClick("a[data-confirm]", (event) => this.confirm(event));

        if (document.documentElement.clientWidth < 600) {
            mouseHandler.onClick(".logo", () => this.toggleMainMenu());
            mouseHandler.onClick(".header nav li", (event) => this.clickMenuListItem(event));
        }
    }

    remove(url) {
        let request = new Request(url, {
            method: "POST",
            cache: "no-cache",
            credentials: "include",
            headers: new Headers({
                "X-Csrf-Token": this.getCsrfToken()
            })
        });

        fetch(request).then(() => {
            window.location.reload();
        });
    }

    confirm(event) {
        let questionElement = document.createElement("span");
        let linkElement = event.target;
        let containerElement = linkElement.parentNode;
        linkElement.style.display = "none";

        let yesElement = document.createElement("a");
        yesElement.href = "#";
        yesElement.appendChild(document.createTextNode(linkElement.dataset.labelYes));
        yesElement.onclick = (event) => {
            event.preventDefault();

            let loadingElement = document.createElement("span");
            loadingElement.className = "loading";
            loadingElement.appendChild(document.createTextNode(linkElement.dataset.labelLoading));

            questionElement.remove();
            containerElement.appendChild(loadingElement);

            this.remove(linkElement.dataset.url);
        };

        let noElement = document.createElement("a");
        noElement.href = "#";
        noElement.appendChild(document.createTextNode(linkElement.dataset.labelNo));
        noElement.onclick = (event) => {
            event.preventDefault();
            linkElement.style.display = "inline";
            questionElement.remove();
        };

        questionElement.className = "confirm";
        questionElement.appendChild(document.createTextNode(linkElement.dataset.labelQuestion + " "));
        questionElement.appendChild(yesElement);
        questionElement.appendChild(document.createTextNode(", "));
        questionElement.appendChild(noElement);

        containerElement.appendChild(questionElement);
    }

    clickMenuListItem(event) {
        let element = event.target;console.log(element);

        if (element.tagName === "A") {
            window.location.href = element.getAttribute("href");
        } else {
            window.location.href = element.querySelector("a").getAttribute("href");
        }
    }

    toggleMainMenu() {
        let menu = document.querySelector(".header nav ul");
        if (this.isVisible(menu)) {
            menu.style.display = "none";
        } else {
            menu.style.display = "block";
        }
    }

    updateEntriesStatus(entryIDs, status) {
        let url = document.body.dataset.entriesStatusUrl;
        let request = new Request(url, {
            method: "POST",
            cache: "no-cache",
            credentials: "include",
            body: JSON.stringify({entry_ids: entryIDs, status: status}),
            headers: new Headers({
                "Content-Type": "application/json",
                "X-Csrf-Token": this.getCsrfToken()
            })
        });

        fetch(request);
    }

    markPageAsRead() {
        let items = this.getVisibleElements(".items .item");
        let entryIDs = [];

        items.forEach((element) => {
            element.classList.add("item-status-read");
            entryIDs.push(parseInt(element.dataset.id, 10));
        });

        if (entryIDs.length > 0) {
            this.updateEntriesStatus(entryIDs, "read");
        }

        this.goToPage("next");
    }

    toggleEntryStatus() {
        let currentItem = document.querySelector(".current-item");
        if (currentItem !== null) {
            let entryID = parseInt(currentItem.dataset.id, 10);
            let statuses = {read: "unread", unread: "read"};

            for (let currentStatus in statuses) {
                let newStatus = statuses[currentStatus];

                if (currentItem.classList.contains("item-status-" + currentStatus)) {
                    this.goToNextListItem();

                    currentItem.classList.remove("item-status-" + currentStatus);
                    currentItem.classList.add("item-status-" + newStatus);

                    this.updateEntriesStatus([entryID], newStatus);
                    break;
                }
            }
        }
    }

    openOriginalLink() {
        let entryLink = document.querySelector(".entry h1 a");
        if (entryLink !== null) {
            this.openNewTab(entryLink.getAttribute("href"));
            return;
        }

        let currentItemOriginalLink = document.querySelector(".current-item a[data-original-link]");
        if (currentItemOriginalLink !== null) {
            this.openNewTab(currentItemOriginalLink.getAttribute("href"));
        }
    }

    openSelectedItem() {
        let currentItemLink = document.querySelector(".current-item .item-title a");
        if (currentItemLink !== null) {
            window.location.href = currentItemLink.getAttribute("href");
        }
    }

    goToPage(page) {
        let element = document.querySelector("a[data-page=" + page + "]");

        if (element) {
            document.location.href = element.href;
        }
    }

    goToPrevious() {
        if (this.isListView()) {
            this.goToPreviousListItem();
        } else {
            this.goToPage("previous");
        }
    }

    goToNext() {
        if (this.isListView()) {
            this.goToNextListItem();
        } else {
            this.goToPage("next");
        }
    }

    goToPreviousListItem() {
        let items = this.getVisibleElements(".items .item");

        if (items.length === 0) {
            return;
        }

        if (document.querySelector(".current-item") === null) {
            items[0].classList.add("current-item");
            return;
        }

        for (let i = 0; i < items.length; i++) {
            if (items[i].classList.contains("current-item")) {
                items[i].classList.remove("current-item");

                if (i - 1 >= 0) {
                    items[i - 1].classList.add("current-item");
                    this.scrollPageTo(items[i - 1]);
                }

                break;
            }
        }
    }

    goToNextListItem() {
        let items = this.getVisibleElements(".items .item");

        if (items.length === 0) {
            return;
        }

        if (document.querySelector(".current-item") === null) {
            items[0].classList.add("current-item");
            return;
        }

        for (let i = 0; i < items.length; i++) {
            if (items[i].classList.contains("current-item")) {
                items[i].classList.remove("current-item");

                if (i + 1 < items.length) {
                    items[i + 1].classList.add("current-item");
                    this.scrollPageTo(items[i + 1]);
                }

                break;
            }
        }
    }

    getVisibleElements(selector) {
        let elements = document.querySelectorAll(selector);
        let result = [];

        for (let i = 0; i < elements.length; i++) {
            if (this.isVisible(elements[i])) {
                result.push(elements[i]);
            }
        }

        return result;
    }

    isListView() {
        return document.querySelector(".items") !== null;
    }

    scrollPageTo(item) {
        let windowScrollPosition = window.pageYOffset;
        let windowHeight = document.documentElement.clientHeight;
        let viewportPosition = windowScrollPosition + windowHeight;
        let itemBottomPosition = item.offsetTop + item.offsetHeight;

        if (viewportPosition - itemBottomPosition < 0 || viewportPosition - item.offsetTop > windowHeight) {
            window.scrollTo(0, item.offsetTop - 10);
        }
    }

    openNewTab(url) {
        let win = window.open(url, "_blank");
        win.focus();
    }

    isVisible(element) {
        return element.offsetParent !== null;
    }

    getCsrfToken() {
        let element = document.querySelector("meta[name=X-CSRF-Token]");

        if (element !== null) {
            return element.getAttribute("value");
        }

        return "";
    }
}

document.addEventListener("DOMContentLoaded", function() {
    (new App()).run();
});

})();
