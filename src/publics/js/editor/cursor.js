import {getCurrentElement, triggerEvent, get_uuid_element} from '../utils.js';
import {DEBUG} from "./main.js";

export default class Cursor{
    
    constructor(element) {
        this.editor = element;

        this.current = {};
        this.color = [
            Math.round(Math.random()*255),
            Math.round(Math.random()*255),
            Math.round(Math.random()*255)
        ];
        this.uuid = getRandomString(10);
        this.request = {};

        // Listen for others caret moves
        document.addEventListener('socket.receive.cursor-moves', e => {
            this.update(e.detail.request.data);
        });

        document.dispatchEvent(new CustomEvent('socket.preprocess', {detail: [this.sendCursorPosition, [this]]}));

        this.editor.addEventListener('focus', this.updateCursorRequest);
        this.editor.addEventListener('click', this.updateCursorRequest);
        this.editor.addEventListener('keypress', this.updateCursorRequest);

    }
    
    updateCursorRequest = () => {
        if(getCurrentElement() === this.editor) return;
        this.request = this.cursorRequest();
    }

    sendCursorPosition(cursor){
        if(Object.keys(cursor.request).length > 0) triggerEvent('socket.send', cursor.request);
        cursor.request = {};
    }

    cursorRequest = () => {
        let element = get_uuid_element();
        if (element.hasAttribute('uuid')) {
            return {
                type: 'cursor-moves',
                data: {
                    uuid: element.getAttribute('uuid'),
                    userId: this.uuid,
                    color: this.color
                }
            };
        }
    }

    /**
     * Update the pointer position depending on gived data.
     * @param {Object.<string, string | Array>} data: Content of 'cursor-moves' request.
     */
    update(data){
        if(data.userId in this.current){
            this.current[data.userId][0].remove();
            this.current[data.userId][1].removeAttribute('contenteditable');
            this.current[data.userId][1].classList.remove('noteditable');
            delete this.current[data.userId];
        }

        const element = document.querySelector('div[uuid="' + data.uuid + '"]');
        if(element === null){
            if(DEBUG) console.log('Cursor position doesn\' exist');
            return;
        }
        const pointer = document.createElement('div');
        pointer.classList.add('pointer');
        pointer.style.top = element.offsetTop + 'px';
        pointer.style.backgroundColor = 'rgb(' + data.color[0] + ', ' + data.color[1] + ', ' + data.color[2] + ')'
        if(DEBUG) pointer.id = getRandomString(20);
        document.getElementById('body').appendChild(pointer);

        element.setAttribute('contenteditable', 'false');
        element.classList.add('noteditable');

        setTimeout(() => {
            if(data.userId in this.current && Date.now() - this.current[data.userId][2] > 9000){
                this.current[data.userId][0].remove();
                this.current[data.userId][1].removeAttribute('contenteditable');
                this.current[data.userId][1].classList.remove('noteditable');
                delete this.current[data.userId];
            }
        }, 10000);

        this.current[data.userId] = [pointer, element, Date.now()];
    }

}
