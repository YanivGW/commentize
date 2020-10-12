import * as vscode from 'vscode';
import { Commentizer } from './commentizer';

export function activate(context: vscode.ExtensionContext) {

	console.log('Commentize is active!');

	let commentSelected = vscode.commands.registerCommand('commentize.commentSelected', () => {
		let commentizer = new Commentizer();
		commentizer.commentSelected();
	});

	let formatFile = vscode.commands.registerCommand('commentize.formatFile', () => {
		let commentizer = new Commentizer();
		commentizer.formatDocument();
	});

	context.subscriptions.push(commentSelected);
	context.subscriptions.push(formatFile);
}

export function deactivate() { }
