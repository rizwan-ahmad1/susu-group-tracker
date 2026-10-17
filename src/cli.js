'use strict';

const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { SusuGroup } = require('./susu-group');
const { formatPesewas, parseMoneyToPesewas } = require('./money');
const { loadGroup, saveGroup } = require('./group-store');

const DEFAULT_DATA_FILE = path.join(process.cwd(), 'data', 'susu-group.json');

async function runCli({ input = stdin, output = stdout, dataFile = DEFAULT_DATA_FILE } = {}) {
  const prompt = readline.createInterface({ input, output });
  try {
    let group = await loadGroup(dataFile);
    if (!group) {
      output.write('Welcome to Susu Group Tracker.\n');
      const name = await prompt.question('Group name: ');
      const contribution = parseMoneyToPesewas(await prompt.question('Weekly contribution (e.g. 25.00): '));
      group = new SusuGroup(name, contribution);
      await saveGroup(dataFile, group);
      output.write(`Created "${group.name}". Add your members to get started.\n`);
    } else {
      output.write(`Loaded "${group.name}" from ${dataFile}.\n`);
    }

    async function updateGroup(change) {
      const previousState = group.toJSON();
      try {
        const result = change();
        await saveGroup(dataFile, group);
        return result;
      } catch (error) {
        group = SusuGroup.fromJSON(previousState);
        throw error;
      }
    }

    let running = true;
    while (running) {
      output.write('\n=== Susu Group Tracker ===\n');
      output.write('1. Add member\n');
      output.write('2. Start a week\n');
      output.write('3. Record a payment\n');
      output.write('4. Show group report\n');
      output.write('5. Close week and pay out\n');
      output.write('6. Save and exit\n');

      const choice = (await prompt.question('Choose an option: ')).trim();
      try {
        switch (choice) {
          case '1': {
            const id = await prompt.question('Member ID (unique): ');
            const name = await prompt.question('Member name: ');
            await updateGroup(() => group.addMember(id, name));
            output.write(`Added ${name.trim()} (${id.trim()}).\n`);
            break;
          }
          case '2': {
            const weekNumber = await updateGroup(() => group.startWeek());
            output.write(`Week ${weekNumber} started.\n`);
            break;
          }
          case '3': {
            const report = group.getReport();
            if (report.memberCount === 0) {
              output.write('Add members before recording payments.\n');
              break;
            }
            output.write(`Members: ${report.rotationOrder.map(({ id, name }) => `${name} (${id})`).join(', ')}\n`);
            const memberId = await prompt.question('Paying member ID: ');
            const amountPesewas = parseMoneyToPesewas(await prompt.question('Payment amount (e.g. 10.00): '));
            await updateGroup(() => group.recordPayment(memberId.trim(), amountPesewas));
            output.write(`Recorded ${formatPesewas(amountPesewas)} for ${memberId.trim()}.\n`);
            break;
          }
          case '4':
            printReport(output, group.getReport());
            break;
          case '5': {
            const payout = await updateGroup(() => group.closeWeek());
            output.write(
              `Week ${payout.weekNumber} closed. ${payout.recipientName} (${payout.recipientId}) receives ${formatPesewas(payout.payoutPesewas)}.\n`,
            );
            break;
          }
          case '6':
            await saveGroup(dataFile, group);
            output.write('Group saved. Goodbye.\n');
            running = false;
            break;
          default:
            output.write('Choose a number from 1 to 6.\n');
        }
      } catch (error) {
        output.write(`Error: ${error.message}\n`);
        if (error.outstanding) {
          for (const item of error.outstanding) {
            output.write(`- ${item.memberName} (${item.memberId}) owes ${formatPesewas(item.owedPesewas)}.\n`);
          }
        }
      }
    }
  } finally {
    prompt.close();
  }
}

function printReport(output, report) {
  output.write(`\nGroup: ${report.groupName}\n`);
  output.write(`Weekly contribution: ${formatPesewas(report.weeklyContributionPesewas)}\n`);
  output.write(`Members (${report.memberCount}): ${report.rotationOrder.map(({ id, name }) => `${name} [${id}]`).join(', ') || 'none'}\n`);
  output.write(`Next payout: ${report.nextRecipient ? `${report.nextRecipient.name} [${report.nextRecipient.id}]` : 'not assigned'}\n`);

  if (report.weeks.length === 0) {
    output.write('No weeks started yet.\n');
    return;
  }
  for (const week of report.weeks) {
    output.write(`\nWeek ${week.weekNumber} - ${week.status}, collected ${formatPesewas(week.paidPesewas)} / ${formatPesewas(week.potPesewas)}\n`);
    for (const payment of week.payments) {
      output.write(`- ${payment.memberName} [${payment.memberId}]: paid ${formatPesewas(payment.paidPesewas)}\n`);
    }
    for (const outstanding of week.outstanding) {
      output.write(`  Owes ${formatPesewas(outstanding.owedPesewas)}\n`);
    }
    if (week.recipientId) output.write(`  Paid out to ${week.recipientId}\n`);
  }
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(`Could not run Susu Group Tracker: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { runCli };
