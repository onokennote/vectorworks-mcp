"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const http = require("http");
function activate(context) {
    let disposable = vscode.commands.registerCommand('vectorworks.searchSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        if (!selectedText) {
            vscode.window.showWarningMessage('No text selected');
            return;
        }
        try {
            // HTTPリクエストでvw_searchを実行
            const url = `http://localhost:8001/?q=${encodeURIComponent(selectedText)}`;
            const response = await new Promise((resolve, reject) => {
                http.get(url, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => resolve(data));
                }).on('error', reject);
            });
            // 結果を新しいタブで表示
            const panel = vscode.window.createWebviewPanel('vectorworksSearch', `Vectorworks: ${selectedText}`, vscode.ViewColumn.Two, {
                enableScripts: true
            });
            panel.webview.html = response;
        }
        catch (error) {
            vscode.window.showErrorMessage(`Search failed: ${error}`);
        }
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map