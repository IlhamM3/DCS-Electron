const __basedir = process.cwd();
const { ipcRenderer } = require('electron');
const ui = require(__basedir + '/assets/js/lib/__ui');

/**
 *	Stores display to be shown later
 *	@param {Object} displayDetails - display to show
 */
function setHoldDisplay(displayDetails){
	const display = localStorage.getItem('holdDisplay');

	if(display){
		throw 'ERROR : holdDisplay already contains value';
	} else{
		localStorage.setItem('holdDisplay', JSON.stringify(displayDetails));
	}
}

ui.ready(async function () {
	$('.selectable').on('click', function () {
		const group = $(this).data('select-group');

		ui.setSelectable($(this), group);
	});
});

ui.ready(async function () {
	$('.reset-selectable').on('click', function () {
		const group = $(this).data('select-group');

		ui.setSelectable(false, group);
	});
});

ui.ready(async function () {
	$('.close-popup').on('click', function () {
		const holdDisplay = +$(this).data('display-hold');

		if(!holdDisplay){
			ui.showPopup(false);
		} else{
			setHoldDisplay({
					type : 'popup',
					name : false,
				});
		}
	});
});

ui.ready(async function () {
	$('.show-popup').on('click', function () {
		const name = $(this).data('popup');
		const holdDisplay = +$(this).data('display-hold');

		if(!holdDisplay){
			ui.showPopup(name);
		} else{
			setHoldDisplay({
					type : 'popup',
					name,
				});
		}
	});
});

ui.ready(async function () {
	$('.show-section').on('click', function () {
		const name = $(this).data('section');
		const holdDisplay = +$(this).data('display-hold');

		if(!holdDisplay){
			ui.showSection(name);
		} else{
			setHoldDisplay({
					type : 'section',
					name,
				});
		}
	});
});

ui.ready(async function () {
	$('.show-content').on('click', function () {
		const name = $(this).data('content');
		const holdDisplay = +$(this).data('display-hold');

		if(!holdDisplay){
			ui.showContent(name);
		} else{
			setHoldDisplay({
					type : 'section',
					name,
				});
		}
	});
});

ui.ready(async function () {
	$('.app-reload').on('click', function () {
		const holdDisplay = +$(this).data('display-hold');

		if(!holdDisplay){
			ipcRenderer.send('app-reload');
		} else{
			setHoldDisplay({
					type : 'reload',
				});
		}
	});
});

ui.ready(async function () {
	$('.btn').on('click', function () {
		const ini = $(this);
		ini.addClass('clicked');
		ini.attr('disabled','disabled');

		setTimeout(()=>{
				ini.removeClass('clicked');
				ini.removeAttr('disabled');
			},250);
	});
});

module.exports = {
	/**
	 *	Displays whatever stored in holdDisplay
	 */
	release(){
		let display = localStorage.getItem('holdDisplay');
		localStorage.removeItem('holdDisplay');

		if(display){
			display = JSON.parse(display);

			switch(display.type){
				case 'section' :
					ui.showSection(display.name);
					break;
				case 'popup' :
					ui.showPopup(display.name);
					break;
				case 'content' :
					ui.showContent(display.name);
					break;
				case 'reload' :
					ipcRenderer.send('app-reload');
					break;
				default : break;
			}
		}
	},
};
