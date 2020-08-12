/* eslint-disable no-console */

import cliMainRunner, { CLIRunners } from './cli';
import { collectSources } from './cli-service';
import { loadSamlangProjectConfiguration } from './configuration';

import { checkSources } from '@dev-sam/samlang-core';

const runners: CLIRunners = {
  typeCheck(needHelp) {
    if (needHelp) {
      console.log('samlang [check]: Type checks your codebase according to sconfig.json.');
    } else {
      const configuration = loadSamlangProjectConfiguration();
      if (
        configuration === 'NO_CONFIGURATION' ||
        configuration === 'UNPARSABLE_CONFIGURATION_FILE' ||
        configuration === 'UNREADABLE_CONFIGURATION_FILE'
      ) {
        console.error(configuration);
        process.exit(2);
      }
      const { compileTimeErrors } = checkSources(collectSources(configuration));
      if (compileTimeErrors.length > 0) {
        console.error(`Found ${compileTimeErrors.length} error(s).`);
        compileTimeErrors
          .map((it) => it.toString())
          .sort((a, b) => a.localeCompare(b))
          .forEach((it) => console.error(it));
        process.exit(1);
      }
      console.log('No errors!');
    }
  },
  compile(needHelp) {
    if (needHelp) {
      console.log('samlang compile: Compile your codebase according to sconfig.json.');
    } else {
      console.error('samlang-compiler WIP.');
    }
  },
  lsp(needHelp) {
    if (needHelp) {
      console.log('samlang lsp: Start an LSP process according to sconfig.json.');
    } else {
      console.error('samlang-lsp WIP.');
    }
  },
  version() {
    console.log('samlang version: unreleased.');
  },
  help() {
    console.log(`
Usage:
samlang [command]

Commands:
[no command]: defaults to check command specified below.
check: Type checks your codebase according to sconfig.json.
compile: Compile your codebase according to sconfig.json.
lsp: Start an LSP process according to sconfig.json.
version: Display samlang version.
help: Show this message.`);
  },
};

cliMainRunner(runners, process.argv.slice(2));
