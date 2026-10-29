// The window's two facts arrive from the controller: the extension's enabled
// state in Safari and the desktop app's reachability on this computer.

function showExtensionState(enabled) {
    document.body.classList.toggle('extension-on', enabled === true);
    document.body.classList.toggle('extension-off', enabled === false);
}

function showDesktopState(reachable) {
    document.body.classList.toggle('desktop-checked', true);
    document.body.classList.toggle('desktop-on', reachable === true);
    document.body.classList.toggle('desktop-off', reachable !== true);
}

function post(message) {
    webkit.messageHandlers.controller.postMessage(message);
}

document.querySelector('button.open-preferences').addEventListener('click', () => post('open-preferences'));
document.querySelector('button.open-website').addEventListener('click', () => post('open-website'));
document.querySelector('button.refresh').addEventListener('click', () => {
    document.body.classList.remove('desktop-checked', 'desktop-on', 'desktop-off');
    post('refresh');
});
