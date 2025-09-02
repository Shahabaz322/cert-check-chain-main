# Sample Hardhat 3 Beta Project (`mocha` and `ethers`)

This project showcases a Hardhat 3 Beta project using `mocha` for tests and the `ethers` library for Ethereum interactions.

To learn more about the Hardhat 3 Beta, please visit the [Getting Started guide](https://hardhat.org/docs/getting-started#getting-started-with-hardhat-3). To share your feedback, join our [Hardhat 3 Beta](https://hardhat.org/hardhat3-beta-telegram-group) Telegram group or [open an issue](https://github.com/NomicFoundation/hardhat/issues/new) in our GitHub issue tracker.

## Project Overview

This example project includes:

- A simple Hardhat configuration file.
- Foundry-compatible Solidity unit tests.
- TypeScript integration tests using `mocha` and ethers.js
- Examples demonstrating how to connect to different types of networks, including locally simulating OP mainnet.

## Usage

### Running Tests

To run all the tests in the project, execute the following command:

```shell
npx hardhat test
```

You can also selectively run the Solidity or `mocha` tests:

```shell
npx hardhat test solidity
npx hardhat test mocha
```

### Make a deployment to Sepolia

This project includes an example Ignition module to deploy the contract. You can deploy this module to a locally simulated chain or to Sepolia.

To run the deployment to a local chain:

```shell
npx hardhat ignition deploy ignition/modules/Counter.ts
```

To run the deployment to Sepolia, you need an account with funds to send the transaction. The provided Hardhat configuration includes a Configuration Variable called `SEPOLIA_PRIVATE_KEY`, which you can use to set the private key of the account you want to use.

You can set the `SEPOLIA_PRIVATE_KEY` variable using the `hardhat-keystore` plugin or by setting it as an environment variable.

To set the `SEPOLIA_PRIVATE_KEY` config variable using `hardhat-keystore`:

```shell
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
```

After setting the variable, you can run the deployment with the Sepolia network:

```shell
npx hardhat ignition deploy --network sepolia ignition/modules/Counter.ts
```

```
cert-check-chain-main
├─ .env
├─ bun.lockb
├─ components.json
├─ contracts
│  ├─ Counter.sol
│  └─ Counter.t.sol
├─ eslint.config.js
├─ hardhat.config.ts
├─ hardhat.tsconfig.json
├─ ignition
│  └─ modules
│     └─ Counter.ts
├─ index.html
├─ package-lock.json
├─ package.json
├─ postcss.config.js
├─ public
│  ├─ favicon.ico
│  ├─ placeholder.svg
│  └─ robots.txt
├─ README.md
├─ scripts
│  └─ send-op-tx.ts
├─ src
│  ├─ App.css
│  ├─ App.tsx
│  ├─ components
│  │  ├─ FileUpload.tsx
│  │  ├─ ui
│  │  │  ├─ accordion.tsx
│  │  │  ├─ alert-dialog.tsx
│  │  │  ├─ alert.tsx
│  │  │  ├─ aspect-ratio.tsx
│  │  │  ├─ avatar.tsx
│  │  │  ├─ badge.tsx
│  │  │  ├─ breadcrumb.tsx
│  │  │  ├─ button.tsx
│  │  │  ├─ calendar.tsx
│  │  │  ├─ card.tsx
│  │  │  ├─ carousel.tsx
│  │  │  ├─ chart.tsx
│  │  │  ├─ checkbox.tsx
│  │  │  ├─ collapsible.tsx
│  │  │  ├─ command.tsx
│  │  │  ├─ context-menu.tsx
│  │  │  ├─ dialog.tsx
│  │  │  ├─ drawer.tsx
│  │  │  ├─ dropdown-menu.tsx
│  │  │  ├─ form.tsx
│  │  │  ├─ hover-card.tsx
│  │  │  ├─ input-otp.tsx
│  │  │  ├─ input.tsx
│  │  │  ├─ label.tsx
│  │  │  ├─ menubar.tsx
│  │  │  ├─ navigation-menu.tsx
│  │  │  ├─ pagination.tsx
│  │  │  ├─ popover.tsx
│  │  │  ├─ progress.tsx
│  │  │  ├─ radio-group.tsx
│  │  │  ├─ resizable.tsx
│  │  │  ├─ scroll-area.tsx
│  │  │  ├─ select.tsx
│  │  │  ├─ separator.tsx
│  │  │  ├─ sheet.tsx
│  │  │  ├─ sidebar.tsx
│  │  │  ├─ skeleton.tsx
│  │  │  ├─ slider.tsx
│  │  │  ├─ sonner.tsx
│  │  │  ├─ switch.tsx
│  │  │  ├─ table.tsx
│  │  │  ├─ tabs.tsx
│  │  │  ├─ textarea.tsx
│  │  │  ├─ toast.tsx
│  │  │  ├─ toaster.tsx
│  │  │  ├─ toggle-group.tsx
│  │  │  ├─ toggle.tsx
│  │  │  ├─ tooltip.tsx
│  │  │  └─ use-toast.ts
│  │  └─ WalletConnect.tsx
│  ├─ contracts
│  │  ├─ package-lock.json
│  │  └─ package.json
│  ├─ hooks
│  │  ├─ use-mobile.tsx
│  │  └─ use-toast.ts
│  ├─ index.css
│  ├─ integrations
│  │  └─ supabase
│  │     └─ client.ts
│  ├─ lib
│  │  ├─ crypto.ts
│  │  ├─ utils.ts
│  │  └─ web3.ts
│  ├─ main.tsx
│  ├─ pages
│  │  ├─ Home.tsx
│  │  ├─ Index.tsx
│  │  ├─ IssueCertificate.tsx
│  │  ├─ NotFound.tsx
│  │  └─ VerifyCertificate.tsx
│  ├─ scripts
│  │  └─ deploy.ts
│  └─ vite-env.d.ts
├─ supabase
│  ├─ config.toml
│  └─ migrations
│     └─ 20250902173033_f1a5b8ce-260c-498c-b65f-9d4e772052dc.sql
├─ tailwind.config.ts
├─ test
│  └─ Counter.ts
├─ tsconfig.app.json
├─ tsconfig.json
├─ tsconfig.node.json
└─ vite.config.ts

```
```
cert-check-chain-main
├─ .env
├─ bun.lockb
├─ components.json
├─ contracts
│  └─ Counter.sol
├─ eslint.config.js
├─ hardhat.config.ts
├─ hardhat.tsconfig.json
├─ ignition
│  └─ modules
│     └─ Counter.ts
├─ index.html
├─ package-lock.json
├─ package.json
├─ postcss.config.js
├─ public
│  ├─ favicon.ico
│  ├─ placeholder.svg
│  └─ robots.txt
├─ README.md
├─ scripts
│  ├─ check-deployment.js
│  ├─ deploy-simple.js
│  ├─ deploy.ts
│  ├─ send-op-tx.ts
│  └─ test-connection.js
├─ src
│  ├─ App.css
│  ├─ App.tsx
│  ├─ components
│  │  ├─ FileUpload.tsx
│  │  ├─ ui
│  │  │  ├─ accordion.tsx
│  │  │  ├─ alert-dialog.tsx
│  │  │  ├─ alert.tsx
│  │  │  ├─ aspect-ratio.tsx
│  │  │  ├─ avatar.tsx
│  │  │  ├─ badge.tsx
│  │  │  ├─ breadcrumb.tsx
│  │  │  ├─ button.tsx
│  │  │  ├─ calendar.tsx
│  │  │  ├─ card.tsx
│  │  │  ├─ carousel.tsx
│  │  │  ├─ chart.tsx
│  │  │  ├─ checkbox.tsx
│  │  │  ├─ collapsible.tsx
│  │  │  ├─ command.tsx
│  │  │  ├─ context-menu.tsx
│  │  │  ├─ dialog.tsx
│  │  │  ├─ drawer.tsx
│  │  │  ├─ dropdown-menu.tsx
│  │  │  ├─ form.tsx
│  │  │  ├─ hover-card.tsx
│  │  │  ├─ input-otp.tsx
│  │  │  ├─ input.tsx
│  │  │  ├─ label.tsx
│  │  │  ├─ menubar.tsx
│  │  │  ├─ navigation-menu.tsx
│  │  │  ├─ pagination.tsx
│  │  │  ├─ popover.tsx
│  │  │  ├─ progress.tsx
│  │  │  ├─ radio-group.tsx
│  │  │  ├─ resizable.tsx
│  │  │  ├─ scroll-area.tsx
│  │  │  ├─ select.tsx
│  │  │  ├─ separator.tsx
│  │  │  ├─ sheet.tsx
│  │  │  ├─ sidebar.tsx
│  │  │  ├─ skeleton.tsx
│  │  │  ├─ slider.tsx
│  │  │  ├─ sonner.tsx
│  │  │  ├─ switch.tsx
│  │  │  ├─ table.tsx
│  │  │  ├─ tabs.tsx
│  │  │  ├─ textarea.tsx
│  │  │  ├─ toast.tsx
│  │  │  ├─ toaster.tsx
│  │  │  ├─ toggle-group.tsx
│  │  │  ├─ toggle.tsx
│  │  │  ├─ tooltip.tsx
│  │  │  └─ use-toast.ts
│  │  └─ WalletConnect.tsx
│  ├─ contracts
│  │  ├─ package-lock.json
│  │  └─ package.json
│  ├─ hooks
│  │  ├─ use-mobile.tsx
│  │  └─ use-toast.ts
│  ├─ index.css
│  ├─ integrations
│  │  └─ supabase
│  │     └─ client.ts
│  ├─ lib
│  │  ├─ crypto.ts
│  │  ├─ utils.ts
│  │  └─ web3.ts
│  ├─ main.tsx
│  ├─ pages
│  │  ├─ Home.tsx
│  │  ├─ Index.tsx
│  │  ├─ IssueCertificate.tsx
│  │  ├─ NotFound.tsx
│  │  └─ VerifyCertificate.tsx
│  ├─ scripts
│  │  └─ deploy.ts
│  └─ vite-env.d.ts
├─ supabase
│  ├─ config.toml
│  └─ migrations
│     └─ 20250902173033_f1a5b8ce-260c-498c-b65f-9d4e772052dc.sql
├─ tailwind.config.ts
├─ test
│  ├─ Counter.ts
│  └─ foundry
│     └─ Counter.t.sol
├─ tsconfig.app.json
├─ tsconfig.json
├─ tsconfig.node.json
├─ typechain-types
│  ├─ common.ts
│  ├─ Counter.ts
│  ├─ factories
│  │  ├─ Counter__factory.ts
│  │  └─ index.ts
│  ├─ hardhat.d.ts
│  └─ index.ts
└─ vite.config.ts

```