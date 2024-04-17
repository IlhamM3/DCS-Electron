const { app, BrowserWindow, ipcMain } = require("electron");
const remote = require("electron")
	.remote;
const { spawn } = require("child_process");

//app config
const config = require("./config/app.config");
const fs = require("fs");

const path = require("path");
const __basedir = process.cwd();

if (config.autoreload) {
	// Enable live reload for all the files inside your project directory
	require("electron-reload")(__dirname, {
		ignored: [/config\/logs\/|node_modules|[/\\]\./],
	});
}

let mainWindow;

//to mitigate compatibilty electron 9 with serialport
app.allowRendererProcessReuse = false;

function createWindow() {
	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: config.window.width,
		height: config.window.height,
		frame: false,
		fullscreen: config.window.fullscreen,
		icon: "./assets/img/favicon.png",
		webPreferences: {
			nodeIntegration: true,
			devTools: config.devTools
				? config.devTools
				: false, // use ternary because cant accept undefined as false
		},
	});

	// and load the index.html of the app.
	mainWindow.loadFile("index.html");

	// Emitted when the window is closed.
	mainWindow.on("closed", function () {
		mainWindow = null;
	});
}

app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", function () {
	if (process.platform !== "darwin") app.quit();
});

app.on("activate", function () {
	if (mainWindow === null) createWindow();
});

ipcMain.on("app-reload", (event, args) => {
	for (const window of BrowserWindow.getAllWindows()) {
		if (window.webContents) {
			window.webContents.reloadIgnoringCache();
		}
	}
});
