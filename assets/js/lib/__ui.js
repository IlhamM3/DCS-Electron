const path = require('path');
const __basedir = process.cwd();
const EventEmitter = require('events');
const fs = require('fs');

const config = require(__basedir + '/config/app.config');

class __uiClass extends EventEmitter{
    constructor() {
		super();
		this.templates = {};
    };

	/**
	 *	Gets all files from directory an its sub-directories
	 *	@private
	 *	@param {string} __path - directory path
	 *	@param {string} __extension - file extension to get
	 *	@returns {Object[]} list of files
	 */
	async getTemplateFiles(__path, __extension){
		const files = [];
		const __readdir = await fs.promises.readdir(__path);

		for(const file of __readdir){
			const stats = await fs.promises.stat(__path + path.sep + file);

			if(stats.isFile() && path.extname(file) === __extension){
				files.push(file);
			} else if(stats.isDirectory()){
				//if file is a directory, recursively get all files inside it and add them into object
				const tmp = await this.getTemplateFiles(path.resolve(__path,file), __extension);

				for(const item of tmp){
					const __file = item instanceof Object
							? {...item}
							: {
								path : (__path + path.sep + path.basename(file,path.extname(file) )+ path.sep + item).replace(__basedir+path.sep, ''),
								type : path.basename(file,path.extname(file)),
							};

					files.push(__file);
				}
			}
		};

		return files;
	};

	/**
	 *	Adds all available templates and store them in global object, so it can be accessed inside this class
	 *	@private
	 *	@param {string} __path - directory path
	 *	@param {string} __extension - file extension to get
	 */
	async addTemplates(__path, __extension){
		const templates = await this.getTemplateFiles(__path, __extension);

		for(const file of templates){
			const fileContent = await fs.promises.readFile(file.path)
				.then(res => res.toString('utf8'))
				.catch(err => '');

			const template = new DOMParser().parseFromString(fileContent, 'text/html');

			if(!this.templates[file.type]){
				this.templates[file.type] = [];
			}

			this.templates[file.type].push(template);
		}

	};

	/**
	 *	Adds available templates into HTML container
	 *	@param {string} container - HTML selector
	 *	@param {string} type - key in this.template
	 */
	async importFromTemplate(container,type){
		const links = this.templates[type];

		try{
			for(const link of links){
				const template = await link.querySelector('template');
				const element = await template.cloneNode(true);

				//add into specific element
				const clone = await document.importNode(template.content, true);
				await document.querySelector(container).appendChild(clone);
			}
		}
		catch(error){
			console.error(type,links,error);
		}
	};

	/**
	 *	Adds all available templates and store them in global object, so it can be accessed inside this class
	 *	@private
	 *	@param {string} __path - directory path
	 *	@param {string} __extension - file extension to get
	 */
	async addContents(__path){
		const __readdir = await fs.promises.readdir(__path);

		for(const file of __readdir){
			const stats = await fs.promises.stat(__path + path.sep + file);

			if(stats.isDirectory()){
				await this.importFromTemplate(`.${file}`, file);
			}
		};
	};

	/**
	 *	Initialization of electron pages
	 *	@returns {Promise} await until process execution finished
	 */
	async init(){
		return new Promise(async (resolve) => {
			// add all available templates
			const templatePath = __basedir+path.sep+'templates';

			await this.addTemplates(templatePath, '.html');
			await this.importFromTemplate('.content', 'sections');
			await this.importFromTemplate('.content', 'popups');

			await this.addContents(templatePath + path.sep + 'contents');

			// add delay, to make sure everything is ready
			setTimeout(resolve, 50);
		});
	};

	/**
	 *	Show or hide popup, will emit event on success
	 * 	@param {(string|boolean)} name - popup's name to be shown or pass false to close all popups
	 */
    showPopup(name = false) {
        if (name === false) {
            $('.popup').hide('fast');
            localStorage.removeItem('popup');
            return;
        }

		if(!name.includes('-popup')){
			name += '-popup';
		}

        localStorage.setItem('popup', name);

        const ini = $('#' + name);
        ini.siblings('.popup').hide();
        ini.show('fast');

		//reset selectable and notification on changing display
		this.resetAllSelectable();
		this.removeNotification();

        this.emit('popup', name);
    };

	/**
	 *	Show section, will emit event on success
	 * 	@param {string} name - section's name to be shown
	 */
    showSection(name) {
		if(!name.includes('-section')){
			name += '-section';
		}

        //save previous-section, just in case
        if (localStorage.getItem('section') !== localStorage.getItem('previous-section')) {
            localStorage.setItem('previous-section', localStorage.getItem('section'));
        }

        localStorage.setItem('section', name);

        const ini = $('#' + name);
        ini.siblings('.section').hide();
        ini.show('fast');

		//reset selectable and notification on changing display
		this.resetAllSelectable();
		this.removeNotification();

        this.emit('section', name);
    };

	/**
	 *	Show Content, will emit event on success
	 * 	@param {string} name - Content's name to be shown
	 */
    showContent(name) {
		if(!name.includes('-content')){
			name += '-content';
		}

        //save previous-content, just in case
        if (localStorage.getItem('content') !== localStorage.getItem('previous-content')) {
            localStorage.setItem('previous-content', localStorage.getItem('content'));
        }

        localStorage.setItem('content', name);

        const ini = $('#' + name);

        if(ini.hasClass('hidden')){
			ini.siblings().addClass('hidden');
			ini.removeClass('hidden');
		}

		ini.siblings().hide();
		ini.show('fast');

		//reset selectable and notification on changing display
		this.resetAllSelectable();
		this.removeNotification();

        this.emit('content', name);
    };

	/**
	 *	Displays default content if it's defined in HTML
	 * 	@param {string} parent - Contents's parent to be resetted
	 */
    resetContent(parent){
		//parent is a class name, check if it's already a class selector or not
		if(!parent.match(/^\.[\w\W]+/)){
			parent = `.${parent}`;
		}

		try{
			const elements = $(`${parent}`).children('.default-content');

			//elem is document HTML object, so we can directly access id without jquery
			const elem = elements[0];

			//show the first one only, if there are multiple element
			this.showContent(elem.id);
		}
		catch(error){
			console.error(`No default-content for '${parent}' :`, error);
		}

	};

	/**
	 *	Displays notification alert
	 * 	@param {string} text - notification's text
	 * 	@param {string} type - bootstrap alert class (success|danger|warning|info|primary)
	 * 	@param {number} ms - how long notification will be shown
	 * 	@param {string} style - css style
	 * 	@param {boolean} animated - animation on show/hide
	 */
    showNotification(text, type = 'success', ms = 1000, style = null, animated = true) {
		if(text === false){
			this.removeNotification();
			return;
		}

        const container = document.getElementById("alert-container");
        const alertId = 'alert-' + Date.now();

        const alert = document.createElement('div');
        alert.setAttribute('id', alertId);
        alert.setAttribute('class', 'col-12 py-2 alert alert-' + type);
        alert.setAttribute('role', 'alert');
        alert.setAttribute('style', style || 'font-size:18pt; display:none;');
        alert.innerHTML = text;

        container.appendChild(alert);

        const elem = document.querySelector('#' + alertId);
        $(elem).siblings().remove();
        $(elem).slideDown('fast');

		if(ms){
			const dismiss = setTimeout(function() {
				$(elem).slideUp()
					.delay(10)
					.queue(function() {
						$(this).remove();
					});
			}, ms);
		}

		return true;
    };

	/**
	 *	Removes all notifications alert
	 */
	removeNotification() {
        const container = document.getElementById("alert-container");
        const parent = $(container);

        parent.children().each(function() {
            $(this).slideUp().delay(10)
                .queue(function() {
                    $(this).remove();
                });
        });
    };

	/**
	 *	Displays or hides spinner loading animation
	 * 	@param {boolean} shown - true to show spinner, false to hide it
	 */
    displaySpinner(shown = true) {
        if (shown) {
            $('.spinner-wrapper').fadeIn('fast');
        } else {
            $('.spinner-wrapper').fadeOut('fast');
        }
    };

	/**
	 *	@alias this.displaySpinner
	 */
    showSpinner(shown = true) {
		this.displaySpinner(shown);
    };

	/**
	 *	Sets active class to current elemen
	 * 	@param {Object} __this - current element in jQuery object
	 * 	@param {string} group - element select group
	 */
	setSelectable(__this, group){
		// if key and value of specific element is specified, use the element as __this
		if(__this && __this.key && __this.value){
			__this = $('[data-select-group="' + group + '"][data-'+__this.key+'="' + __this.value + '"]');
		}

		const buttons = $('*[data-select-group="' + group + '"]');

		if(__this){
			buttons.removeClass('active');
			__this.addClass('active');
		} else{
			buttons.each(function () {
				$(this).removeClass('active');
			});
		}
	}

	/**
	 *	Resets all selectable element
	 */
	resetAllSelectable(){
		$('.selectable').removeClass('active');
	};

	/**
	 *	Returns active popup
	 * 	@param {boolean} [isNameOnly=true] - to return name only or with suffix
	 * 	@returns {string}
	 */
    getCurrentPopup(isNameOnly = true) {
        const popup = localStorage.getItem('popup');
        return (isNameOnly) ? (section.replace('-popup', '')) : (popup);
    };

	/**
	 *	Returns active section
	 * 	@param {boolean} [isNameOnly=true] - to return name only or with suffix
	 * 	@returns {string}
	 */
    getCurrentSection(isNameOnly = true) {
        const section = localStorage.getItem('section');
        return (isNameOnly) ? (section.replace('-section', '')) : (section);
    };

	/**
	 *	Returns active content
	 * 	@param {boolean} [isNameOnly=true] - to return name only or with suffix
	 * 	@returns {string}
	 */
    getCurrentContent(isNameOnly = true) {
        const content = localStorage.getItem('content');
        return (isNameOnly) ? (content.replace('-content', '')) : (content);
    };

	/**
	 *	Removes all children of selected element
	 * 	@param {Object} elem - DOM Node
	 * 	@returns {boolean}
	 */
	removeChildren(elem){
		if(elem.hasChildNodes()){
			let first = elem.firstElementChild;
			while(first){
				first.remove();
				first = elem.firstElementChild;
			}

			return true;
		} else{
			return false;
		}
	};

	/**
	 *	Adds function to be executed once DOMContentLoaded fired
	 * 	@callback fn
	 */
	DOMContentLoaded(fn) {
		if (document.readyState != 'loading'){
			fn();
		} else {
			document.addEventListener('DOMContentLoaded', fn);
		}
	};

	/**
	 *	Triggers __DOCUMENT__READY__ event
	 * 	@param {boolean} deleteTemplate - delete templates or not
	 */
	documentReady(deleteTemplate = true){
		this.emit('__DOCUMENT__READY__');

		if(deleteTemplate && this.templates){
			// delete templates as it's no longer used
			delete this.templates;
		}
	};

	/**
	 *	Adds function to be executed once __DOCUMENT__READY__ fired
	 * 	@callback fn
	 */
	ready(fn) {
		this.once('__DOCUMENT__READY__', fn);
	};

}

module.exports = new __uiClass();
