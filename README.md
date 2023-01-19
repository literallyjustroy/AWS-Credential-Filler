# AWS Landing Zone Creds Fill

This project:
1. Navigates to a given AWS Landing zone
2. Signs in with the provided USERNAME and PASSWORD(using MFA passed as an argument or on the clipboard)
3. Copies the CLI credentials from the first account in the list to the clipboard
4. Saves them as the \[default\] account in the users ~/.aws/credentials file
5. Clears the clipboard

## Setup

You should setup a `.env` file following the format of the `.env.example` file.

I'd also recommend binding this to an alias. For example, add the following to your `~/.zshrc` file:

```shell
alias creds="node ~/dev/auto/creds/index.js"
```

This allows you to run `creds` from anywhere
## Usage

Copy your MFA code to your clipboard (or paste it as an optional first argument) and run the following command:

```shell
npm run start
```
