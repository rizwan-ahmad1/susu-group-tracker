'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { SusuGroup } = require('./susu-group');

async function loadGroup(filePath) {
  let contents;
  try {
    contents = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }

  let savedData;
  try {
    savedData = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Could not parse saved group file "${filePath}": ${error.message}`);
  }
  return SusuGroup.fromJSON(savedData);
}

async function saveGroup(filePath, group) {
  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.mkdir(directory, { recursive: true });
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(group.toJSON(), null, 2)}\n`, 'utf8');
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
}

module.exports = { loadGroup, saveGroup };
