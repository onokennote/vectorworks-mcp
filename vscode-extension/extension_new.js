const vscode = require('vscode');

function activate(context) {
  console.log('Vectorworks Search extension は起動しました');

  // コマンド1: Vectorworksドキュメント検索
  const searchCommand = vscode.commands.registerCommand('vectorworks.search', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('エディタが開かれていません');
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    
    if (!selectedText.trim()) {
      vscode.window.showWarningMessage('テキストを選択してください');
      return;
    }

    try {
      const http = require('http');
      const url = `http://localhost:8001/?q=${encodeURIComponent(selectedText)}`;
      
      vscode.window.showInformationMessage(`検索中: ${selectedText}`);
      
      const response = await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(5000, () => reject(new Error('タイムアウト')));
      });
      
      const panel = vscode.window.createWebviewPanel(
        'vectorworksSearch',
        `Vectorworks検索: ${selectedText}`,
        vscode.ViewColumn.Two,
        { enableScripts: true }
      );

      panel.webview.html = response;
      
    } catch (error) {
      vscode.window.showErrorMessage(`検索エラー: ${error.message}`);
    }
  });

  // コマンド2: Copilot質問（基本版）
  const copilotCommand = vscode.commands.registerCommand('vectorworks.copilot', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('エディタが開かれていません');
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    
    if (!selectedText.trim()) {
      vscode.window.showWarningMessage('テキストを選択してください');
      return;
    }

    const question = `VectorScript関数「${selectedText}」について日本語で詳しく説明してください。使用方法、パラメータ、使用例も含めてください。`;
    
    await vscode.env.clipboard.writeText(question);
    
    try {
      await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
    } catch (e) {
      console.log('Copilot panel focus failed:', e);
    }
    
    vscode.window.showInformationMessage(
      `「${selectedText}」の質問をクリップボードにコピーしました。Copilot Chatで Ctrl+V してください。`
    );
  });

  // コマンド3: MCP + Copilot質問（詳細版）
  const mcpCopilotCommand = vscode.commands.registerCommand('vectorworks.mcpCopilot', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('エディタが開かれていません');
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    
    if (!selectedText.trim()) {
      vscode.window.showWarningMessage('テキストを選択してください');
      return;
    }

    try {
      vscode.window.showInformationMessage(`詳細情報を取得中: ${selectedText}`);
      
      const http = require('http');
      const searchUrl = `http://localhost:8001/?q=${encodeURIComponent(selectedText)}`;
      
      const searchResponse = await new Promise((resolve, reject) => {
        const req = http.get(searchUrl, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(5000, () => reject(new Error('タイムアウト')));
      });
      
      const textContent = searchResponse.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const relevantInfo = textContent.substring(0, 800);
      
      const detailedQuestion = `VectorScript関数「${selectedText}」について日本語で詳しく説明してください。

参考情報:
${relevantInfo}

以下について教えてください:
1. 関数の目的と動作
2. パラメータの詳細
3. 戻り値の説明
4. 使用例
5. 注意点`;

      await vscode.env.clipboard.writeText(detailedQuestion);
      
      try {
        await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
      } catch (e) {
        console.log('Copilot panel focus failed:', e);
      }
      
      vscode.window.showInformationMessage(
        `「${selectedText}」の詳細質問をクリップボードにコピーしました。Copilot Chatで Ctrl+V してください。`
      );
      
    } catch (error) {
      vscode.window.showErrorMessage(`エラー: ${error.message}`);
    }
  });

  context.subscriptions.push(searchCommand, copilotCommand, mcpCopilotCommand);
}

function deactivate() {
  console.log('Vectorworks Search extension が停止しました');
}

module.exports = { activate, deactivate };