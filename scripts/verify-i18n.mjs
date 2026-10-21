import { getCatalogs } from '@lingui/cli/api';
import { getConfig } from '@lingui/conf';
import path from 'node:path';

const invocationDirectory = process.cwd();
const appDirectory = path.resolve(process.argv[2] ?? '.');
const appLabel = path.relative(invocationDirectory, appDirectory) || '.';
process.chdir(appDirectory);

const config = getConfig({ cwd: appDirectory });
const catalogs = await getCatalogs(config);

if (catalogs.length === 0) {
	throw new Error(`No Lingui catalogs configured in ${appDirectory}`);
}

let verifiedMessages = 0;

for (const catalog of catalogs) {
	const extracted = await catalog.collect();
	if (!extracted) {
		throw new Error(`Lingui extraction failed for ${catalog.path}`);
	}

	const committedByLocale = await catalog.readAll();
	const extractedIds = new Set(Object.keys(extracted));

	for (const locale of config.locales) {
		const committed = committedByLocale[locale];
		if (!committed) {
			throw new Error(`Missing ${locale} catalog for ${catalog.path}`);
		}

		const problems = [];
		for (const [id, message] of Object.entries(extracted)) {
			const entry = committed[id];
			if (!entry || entry.obsolete) {
				problems.push(`missing message ${id} (${message.message})`);
				continue;
			}
			if (entry.message !== message.message || entry.context !== message.context) {
				problems.push(`stale source for ${id} (${message.message})`);
			}
			if (typeof entry.translation !== 'string' || entry.translation.length === 0) {
				problems.push(`missing ${locale} translation for ${id} (${message.message})`);
			}
		}

		for (const [id, entry] of Object.entries(committed)) {
			if (!entry.obsolete && !extractedIds.has(id)) {
				problems.push(`obsolete committed message ${id} (${entry.message ?? ''})`);
			}
		}

		if (problems.length > 0) {
			throw new Error(
				`Lingui catalog verification failed for ${locale}:\n${problems
					.slice(0, 25)
					.map((problem) => `- ${problem}`)
					.join('\n')}${problems.length > 25 ? `\n- …and ${problems.length - 25} more` : ''}`,
			);
		}
	}

	verifiedMessages += extractedIds.size;
}

console.log(
	`Verified ${verifiedMessages} Lingui messages across ${config.locales.length} locales in ${appLabel}.`,
);
