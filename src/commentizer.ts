import * as vscode from 'vscode';

type Alignment = 'left' | 'center' | 'right';

export interface CommentConfig {
    name: string;
    lineLength?: number;
    fillChar: string;
    alignment: Alignment;
    isEdgeSpaces: boolean;
    isTextSpaces: boolean;
};

interface Comment {
    config: CommentConfig;
    regex: RegExp;
}

interface Configuration {
    lineLength: number;
    commentsConfigs: CommentConfig[];
}

export class Commentizer {
    // Read from the package.json
    private configuration: Configuration = vscode.workspace.getConfiguration('commentize') as any;

    private lineLength: number = this.configuration.lineLength;
    private comments: Comment[] = [];

    public constructor() {
        this.setComments();
    }

    /**
    * Turns editor's selected text to comment
    */
    public commentSelected() {
        /* Check if there's an active editor */
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const selectedText = editor.document.getText(editor.selection)
        const lineRange = editor.document.lineAt(editor.selection.active).range;

        const names = this.comments.map(comment => comment.config.name);
        if (names.length === 0) {
            vscode.window.showErrorMessage("Can't commentize :(");
            return;
        }

        vscode.window.showQuickPick(names, { canPickMany: false }).then(
            pickedName => {
                const config = this.comments.find(comment => comment.config.name === pickedName)?.config;
                const comment = (config) ? this.buildCommentFromConfig(selectedText, config) : undefined;

                if (!comment) {
                    vscode.window.showErrorMessage("Can't commentize :(");
                    return;
                }

                /* Replace selection with comment */
                editor.edit(editBuilder => {
                    editBuilder.replace(lineRange, comment);
                });

                // TODO: Set cursor to end of line
            }
        );
    }

    /**
    * Format all comments in document that match comment configs
    */
    public formatDocument() {
        /* Check if there's an active editor */
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        /* Get the whole document's text */
        let document = editor.document;
        let text = document.getText();

        const formattedDoc = this.format(text);

        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(text.length - 1)
        )

        editor.edit(editBuilder => {
            editBuilder.replace(fullRange, formattedDoc);
        });
    }

    /**
    * Builds a comment from text, based on a comment configuration
    * @param text Text to turn into comment
    * @param config The comment's configuration
    * @returns The built comment
    */
    private buildCommentFromConfig(text: string, config: CommentConfig): string | undefined {
        const lineLength: number = config.lineLength ? config.lineLength : this.lineLength;

        const overhead = '/*'.length + 2 * ((config.isEdgeSpaces ? 1 : 0) + (config.isTextSpaces ? 1 : 0)) + '*/'.length;

        /* Check that text is commentizeable - text's length is guarenteed to be positive since key binding
           is only active when editorHasSelection */
        if (text.length + overhead > lineLength) {
            return undefined;
        }

        const fillLength = lineLength - overhead - text.length;
        const [leftFill, rightFill] = this.buildFills(config.alignment, config.fillChar, fillLength);

        /* Build the comment */
        let comment = config.isTextSpaces ? ` ${text} ` : text;
        comment = `${leftFill}${comment}${rightFill}`;
        comment = config.isEdgeSpaces ? ` ${comment} ` : comment;
        comment = `/*${comment}*/`;

        return comment
    }

    /**
    * Finds all unformatted comments in text and formats them
    * @param text Text to scan
    * @returns The formatted text
    */
    private format(text: string): string {
        let res = text;
        for (let { config, regex } of this.comments) {
            res = res.replace(regex, (m, c) => {
                const res = this.buildCommentFromConfig(c, config);
                return (res) ? res : c;
            });
        }

        return res;
    }

    /**
    * Builds fill strings based on alignment
    * @param alignment Comment alignment
    * @param fillChar Character to fill with
    * @param fillLength Total length of fill
    * @returns Left & right fills
    */
    private buildFills(alignment: Alignment, fillChar: string, fillLength: number): [leftFill: string, rightFill: string] {
        let leftFill = '', rightFill = '';

        switch (alignment) {
            case 'left':
                leftFill = '';
                rightFill = fillChar.repeat(fillLength);
                break;
            case 'center':
                leftFill = fillChar.repeat(Math.floor(fillLength / 2));
                rightFill = fillChar.repeat(Math.ceil(fillLength / 2));
                break;
            case 'right':
                leftFill = fillChar.repeat(fillLength);
                rightFill = '';
                break;
            default:
                break;
        }

        return [leftFill, rightFill];
    }

    /**
    * Builds regular expression that matches a comment configuration
    * @param config Comment configuration
    * @returns Reguler expression
    */
    private buildRegex(config: CommentConfig): RegExp {
        let start = `\\/\\*`;
        let end = `\\*\\/`;

        if (config.isEdgeSpaces) {
            start = `${start} `;
            end = ` ${end}`;
        }

        const fillMultiple = `[\\${config.fillChar}]{2,}`;

        switch (config.alignment) {
            case 'left':
                end = `${fillMultiple}${end}`;
                break;
            case 'center':
                start = `${start}${fillMultiple}`;
                end = `${fillMultiple}${end}`;
                break;
            case 'right':
                start = `${start}${fillMultiple}`;
                break;
            default:
                break;
        }

        if (config.isTextSpaces) {
            start = `${start} `;
            end = ` ${end}`;
        }

        const text = `([a-zA-z1-9].*[a-zA-z1-9])`;

        return new RegExp(`${start}${text}${end}`, 'g');
    }

    /**
    * Sets the comments property
    */
    private setComments(): void {
        for (const config of this.configuration.commentsConfigs) {
            this.comments.push({
                config: config,
                regex: this.buildRegex(config)
            });
        }
    }
}