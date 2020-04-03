
 export default class xPathGenerator {
    constructor(doc, options) {
        this.doc = doc;
        this.options = options || {
            checkVisibility: true
        };
    }

    getAttributes(element) {
        var attrs = element.attributes;
        var result = [];
        for (var i = 0; i < attrs.length; i++) {
            result.push({ 'name': attrs[i].name, 'value': attrs[i].value })
        }
        return result;
    }
    getTagName(element) {
        return element.tagName.toLowerCase();
    }
    getPreviousSiblings(element) {
        var siblings = [];
        var current = element.previousElementSibling;
        while (current) {
            siblings.push({
                tag: this.getTagName(current),
                attributes: this.getAttributes(current),
                text: this.getText(current),
                innerText: current.innerText,
            });
            current = current.previousElementSibling
        }
        return siblings;
    }
    getNextSiblings(element) {
        var siblings = [];
        var current = element.nextElementSibling;
        while (current) {
            siblings.push({
                tag: this.getTagName(current),
                attributes: this.getAttributes(current),
                text: this.getText(current),
                innerText: current.innerText,
            });
            current = current.nextElementSibling
        }
        return siblings;
    }
    getData(element, level) {
        var parent;
        if (level === undefined) level = 0;
        if (element.parentElement !== null)
            parent = this.getData(element.parentElement, ++level);
        return {
            tag: this.getTagName(element),
            attributes: this.getAttributes(element),
            parent: parent,
            previousSiblings: this.getPreviousSiblings(element),
            nextSiblings: this.getNextSiblings(element),
            text: this.getText(element),
        }
    }
    findElementsByXpath(xpathToExecute) {
        var result = [];
        try {
            var nodesSnapshot = this.doc.evaluate(xpathToExecute, this.doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            for (var i = 0; i < nodesSnapshot.snapshotLength; i++) {
                result.push(nodesSnapshot.snapshotItem(i));
            }
        }
        catch (e) { }
        return result;
    }
    isVisible(el) {
        if (!this.options.checkVisibility)
            return true;
        let result = !(el.offsetWidth === 0 && el.offsetHeight === 0);
        return result;
    }
    getText(element, result, parents, level) {
        if (level > 5) return result;
        function addToResult(level, text, p, tag) {
            if (text === undefined || text === null || text === '') {
                return;
            }
            text = text.replace(/\r?\n|\r/g, '');
            let match = text.match(/^\s+$/)
            if (match === null)
                result.push({
                    level: level,
                    text: text,
                    tag: tag,
                    parents: p
                });
        }
        if (result === undefined) result = [];
        if (parents === undefined) parents = [];
        if (level === undefined) level = 0;
        var children = element.childNodes;
        if (children.length > 0) {
            for (var i = 0; i < children.length; i++) {
                var child = children[i];
                if (child.nodeType === 3) {
                    if (children.length === 1) parents.push(this.getTag(element));
                    addToResult(level, child.textContent, Array.from(parents), this.getTag(element));
                }
                else if (child.nodeType === 1) {
                    if (level !== 0) parents.push(this.getTag(element));
                    this.getText(child, result, Array.from(parents), level + 1);
                }

            }
        }
        else if (element.nodeType === 3) { // if node is text
            addToResult(level, element.textContent, parents, null);
        }
        else if (element.nodeType === 1) { // if node is element
            addToResult(level, element.innerText, parents, this.getTag(element));
        }
        return result;
    }
    getTag(el) {
        let tag = el.tagName.toLowerCase();
        if (tag === 'svg')
            return "*[name()='svg']";
        return tag;
    }
    xpathStrategyFormElement(el) {
        // preceding siblings
        var texts = [], tempEl = el;
        while (tempEl.previousSibling) {
            tempEl = tempEl.previousSibling;
            texts.push(...this.getText(tempEl));
        }

        var xpaths = [];
        for (var i = 0; i < texts.length; i++) {
            let xpath = `//${this.getTag(el)}[preceding-sibling::*[descendant::text()='${texts[i].text}']]`
            xpaths.push(xpath);
        }

        // following siblings
        tempEl = el;
        while (tempEl.nextSibling) {
            tempEl = tempEl.nextSibling;
            texts.push(...this.getText(tempEl));
        }

        for (var i = 0; i < texts.length; i++) {
            let xpath = `//${this.getTag(el)}[following-sibling::*[descendant::text()='${texts[i].text}']]`
            xpaths.push(xpath);
        }

        return xpaths;
    }
    xpathStrategyText(el) {
        var xpaths = [];
        if (el.nodeType === 1 && el.innerText !== undefined) {
            let xpath = `//${this.getTag(el)}[normalize-space(.)='${el.innerText.trim()}']`
            xpaths.push(xpath);
        }
        let texts = this.getText(el);
        for (var i = 0; i < texts.length; i++) {
            let text = texts[i];
            let xpath = `//${text.tag}[text()='${text.text}']`
            xpaths.push(xpath);
        }

        return xpaths;
    }
    prepareElement(el) {
        try {
            el.style.textTransform = 'none';
        }
        catch (e) { }
    }
    neutralizeElement(el) {
        try {
            el.style.textTransform = '';
        }
        catch (e) { }
    }
    xpathStrategies(el) {
        this.prepareElement(el);

        var xpaths = [];
        xpaths.push(...this.xpathStrategyFormElement(el));
        xpaths.push(...this.xpathStrategyText(el));
        // TODO: Add more xpath strategies

        const uniqueXpaths = [], fallbackXpaths = [];
        for (var i = 0; i < xpaths.length; i++) {
            let xpath = xpaths[i];
            var foundElements = this.findElementsByXpath(xpath);
            var visibleElements = foundElements.filter(d => { return this.isVisible(d) });
            if (visibleElements.length === 1 && el === visibleElements[0]) {
                uniqueXpaths.push(xpath)
            }
            else if (visibleElements.length > 1) {
                const index = visibleElements.indexOf(el) + 1;
                let xpathWithPosition = `(${xpath})[${index}]`;
                foundElements = this.findElementsByXpath(xpathWithPosition);
                visibleElements = foundElements.filter(d => { return this.isVisible(d) });
                if (visibleElements.length === 1 && el === visibleElements[0]) {
                    fallbackXpaths.push(xpathWithPosition)
                }
            }
        }

        this.neutralizeElement(el);
        
        if (uniqueXpaths.length === 0) return fallbackXpaths;

        return {
            unique: uniqueXpaths,
            all: xpaths
        };
    }
}
