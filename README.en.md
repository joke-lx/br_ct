# Bro Chat Browser Extension

## Project Overview

Bro Chat is a browser extension designed to provide a unified message sending interface for multiple AI platforms, including Yuanbao and Gemini. By simulating user interactions, the extension实现了 automated message sending functionality on the web pages of various AI platforms.

## Key Features

- Multi-platform Support: Compatible with multiple AI platforms such as Yuanbao and Gemini
- Automated Interaction: Simulates user input and click operations
- Message Scheduling: Provides a unified message sending interface
- Environment Detection: Automatically identifies whether the current page is a supported AI platform
- Logging: Detailed runtime log output for debugging and troubleshooting

## Technical Features

- Uses a hybrid strategy of CSS selectors and XPath to locate page elements
- Implements an elegant error handling mechanism
- Supports asynchronous message passing
- Provides a retry mechanism to ensure reliable message delivery
- Adopted modular design with clear code structure

## File Structure

- `contentScripts/`: Contains adaptation scripts for various AI platforms
- `popup/`: Extension popup interface related files
- `funcs/`: Functional modules and utility functions
- `backgroudtask/`: Background task processing
- `icons/`: Extension icon resources

## Installation and Usage

1. Clone the repository
2. Load the unpacked extension from the browser extensions management page
3. Visit a supported AI platform page to activate the extension automatically

## Contribution Guide

Code contributions are welcome! Please follow these guidelines:

1. Create a new branch for development
2. Maintain consistent code style
3. Submit clear commit messages
4. Update relevant documentation

## License

This project is licensed under the MIT License. Please refer to the LICENSE file for details.
