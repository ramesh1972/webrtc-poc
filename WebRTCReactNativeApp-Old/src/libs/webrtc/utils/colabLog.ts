export default function colabLog(dataChanneLabel: any, ...args: any[]) {
    // override log to display from user
    let userName = 'unknown';

    if (dataChanneLabel === null || dataChanneLabel === undefined) {
        userName = 'unknown';
    }
    else if (dataChanneLabel.fromChannel === null || dataChanneLabel.fromChannel === undefined) {
        userName = 'unknown';
    }
    else
        userName = dataChanneLabel!.fromChannel?.name;

    console.log(userName, " --> ", ...args);
}
