import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { Firestore } from '@google-cloud/firestore';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const DEFAULT_COLLECTION = 'line_scam_police_stations';
const MAX_BATCH_SIZE = 400;

const usage = () => {
  console.error(
    [
      'Usage:',
      '  node server/scripts/import_line_scam_police_stations_csv.mjs <csvPath> [--replace] [--dry-run] [--collection=<name>]',
      '',
      'Examples:',
      '  node server/scripts/import_line_scam_police_stations_csv.mjs "C:\\\\Users\\\\me\\\\Downloads\\\\stations.csv" --replace',
      '  node server/scripts/import_line_scam_police_stations_csv.mjs "./stations.csv" --collection=line_scam_police_stations',
    ].join('\n')
  );
};

const normalizeSearchToken = (valueInput) =>
  String(valueInput || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const normalizeHeader = (valueInput) =>
  String(valueInput || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()\-_/\\:.;'"`]/g, '');

const parseCsvRows = (textInput) => {
  const text = String(textInput || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (char === '\r') continue;
    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows
    .map((cells) => cells.map((value) => String(value || '').trim()))
    .filter((cells) => cells.some((value) => value.length > 0));
};

const normalizeGeoCoordinate = (valueInput, min, max) => {
  const value = Number.parseFloat(String(valueInput || '').trim());
  if (!Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return Number(value.toFixed(7));
};

const isNearZeroGeoPair = (latitudeInput, longitudeInput) => {
  const latitude = normalizeGeoCoordinate(latitudeInput, -90, 90);
  const longitude = normalizeGeoCoordinate(longitudeInput, -180, 180);
  if (latitude === null || longitude === null) return false;
  return Math.abs(latitude) < 0.0000001 && Math.abs(longitude) < 0.0000001;
};

const normalizeMapUrl = (valueInput) => {
  const value = String(valueInput || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(value)) return `https://${value}`;
  return '';
};

const extractGeoPairFromMapUrl = (mapUrlInput) => {
  const mapUrl = normalizeMapUrl(mapUrlInput || '');
  if (!mapUrl) return { latitude: null, longitude: null };
  const candidateTexts = [mapUrl];
  try {
    const decoded = decodeURIComponent(mapUrl);
    if (decoded && decoded !== mapUrl) candidateTexts.push(decoded);
  } catch {
    // keep original text only
  }
  const regexPatterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i,
    /[?&](?:q|query|ll|sll|center|daddr|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
    /[?&](?:q|query|ll|sll|center|daddr|destination)=[^&]*?(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
  ];
  for (const text of candidateTexts) {
    for (const regex of regexPatterns) {
      const match = String(text || '').match(regex);
      if (!match) continue;
      const latitude = normalizeGeoCoordinate(match[1], -90, 90);
      const longitude = normalizeGeoCoordinate(match[2], -180, 180);
      if (latitude === null || longitude === null) continue;
      if (isNearZeroGeoPair(latitude, longitude)) continue;
      return { latitude, longitude };
    }
  }
  return { latitude: null, longitude: null };
};

const resolveStationGeoPair = ({ latitudeInput, longitudeInput, mapUrlInput }) => {
  let latitude = normalizeGeoCoordinate(latitudeInput, -90, 90);
  let longitude = normalizeGeoCoordinate(longitudeInput, -180, 180);
  const hasRawPair = latitude !== null && longitude !== null && !isNearZeroGeoPair(latitude, longitude);
  if (!hasRawPair) {
    const extracted = extractGeoPairFromMapUrl(mapUrlInput || '');
    latitude = extracted.latitude;
    longitude = extracted.longitude;
  }
  const isValidPair = latitude !== null && longitude !== null && !isNearZeroGeoPair(latitude, longitude);
  if (!isValidPair) return { latitude: null, longitude: null };
  return { latitude, longitude };
};

const getCell = (rowInput, index) => {
  const row = Array.isArray(rowInput) ? rowInput : [];
  if (!Number.isInteger(index) || index < 0 || index >= row.length) return '';
  return String(row[index] || '').trim();
};

const buildStationId = (stationInput) => {
  const station = stationInput && typeof stationInput === 'object' && !Array.isArray(stationInput) ? stationInput : {};
  const hashText = [
    normalizeSearchToken(station.name),
    normalizeSearchToken(station.address),
    normalizeSearchToken(station.phone),
    normalizeSearchToken(station.mapUrl),
  ].join('|');
  const digest = crypto.createHash('sha1').update(hashText).digest('hex');
  return `ps_${digest.slice(0, 24)}`;
};

const scoreStation = (stationInput) => {
  const station = stationInput && typeof stationInput === 'object' && !Array.isArray(stationInput) ? stationInput : {};
  const fields = [
    station.name,
    station.address,
    station.phone,
    station.mapUrl,
    station.province,
    station.district,
    station.latitude,
    station.longitude,
  ];
  return fields.reduce((sum, value) => {
    if (value === null || value === undefined) return sum;
    return String(value).trim() ? sum + 1 : sum;
  }, 0);
};

const findHeaderIndex = (headerIndex, aliasesInput) => {
  const aliases = Array.isArray(aliasesInput) ? aliasesInput : [];
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    if (headerIndex.has(key)) return Number(headerIndex.get(key));
  }
  return -1;
};

const deleteCollectionDocs = async (firestore, collectionRef) => {
  let totalDeleted = 0;
  while (true) {
    const snapshot = await collectionRef.limit(MAX_BATCH_SIZE).get();
    if (snapshot.empty) break;
    const batch = firestore.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snapshot.size;
    if (snapshot.size < MAX_BATCH_SIZE) break;
  }
  return totalDeleted;
};

const run = async () => {
  const args = process.argv.slice(2);
  const csvPathArg = args.find((arg) => !String(arg).startsWith('--'));
  const shouldReplace = args.includes('--replace');
  const dryRun = args.includes('--dry-run');
  const collectionOption = args.find((arg) => String(arg).startsWith('--collection='));
  const collectionFromArg = collectionOption ? String(collectionOption).slice('--collection='.length) : '';
  const collectionName = String(
    collectionFromArg || process.env.FIRESTORE_LINE_SCAM_POLICE_STATION_COLLECTION || DEFAULT_COLLECTION
  ).trim();

  if (!csvPathArg || !collectionName) {
    usage();
    process.exit(1);
  }

  const absoluteCsvPath = path.resolve(csvPathArg);
  const csvRaw = await readFile(absoluteCsvPath, 'utf8');
  const parsedRows = parseCsvRows(csvRaw);
  if (parsedRows.length <= 1) {
    throw new Error('CSV has no data rows.');
  }

  const headerRow = parsedRows[0];
  const headerIndex = new Map();
  headerRow.forEach((header, idx) => {
    headerIndex.set(normalizeHeader(header), idx);
  });

  const nameIndex = findHeaderIndex(headerIndex, ['ชื่อสถานี', 'ชื่อสถานีตำรวจ', 'stationname', 'name']);
  const addressIndex = findHeaderIndex(headerIndex, ['ที่อยู่', 'address']);
  const phoneIndex = findHeaderIndex(headerIndex, ['เบอร์', 'เบอร์โทร', 'เบอร์ติดต่อ', 'phone', 'tel']);
  const mapUrlIndex = findHeaderIndex(headerIndex, [
    'ลิงก์ google map',
    'ลิงก์ google maps',
    'google map',
    'mapurl',
    'map link',
  ]);
  const provinceIndex = findHeaderIndex(headerIndex, ['จังหวัด', 'province']);
  const districtIndex = findHeaderIndex(headerIndex, ['อำเภอ', 'เขต', 'district']);
  const latitudeIndex = findHeaderIndex(headerIndex, ['lat', 'latitude', 'ละติจูด']);
  const longitudeIndex = findHeaderIndex(headerIndex, ['lng', 'lon', 'longitude', 'ลองจิจูด']);

  if (nameIndex < 0) {
    throw new Error('CSV missing station-name column (expected: ชื่อสถานี or name).');
  }

  const uniqueStations = new Map();
  let skippedNoName = 0;
  let duplicateRows = 0;

  for (let rowIndex = 1; rowIndex < parsedRows.length; rowIndex += 1) {
    const row = parsedRows[rowIndex];
    const name = getCell(row, nameIndex);
    if (!name) {
      skippedNoName += 1;
      continue;
    }
    const mapUrl = normalizeMapUrl(getCell(row, mapUrlIndex));
    const geoPair = resolveStationGeoPair({
      latitudeInput: getCell(row, latitudeIndex),
      longitudeInput: getCell(row, longitudeIndex),
      mapUrlInput: mapUrl,
    });
    const station = {
      name,
      address: getCell(row, addressIndex),
      phone: getCell(row, phoneIndex),
      mapUrl,
      province: getCell(row, provinceIndex),
      district: getCell(row, districtIndex),
      latitude: geoPair.latitude,
      longitude: geoPair.longitude,
    };
    const stationId = buildStationId(station);
    const existing = uniqueStations.get(stationId);
    if (existing) {
      duplicateRows += 1;
      if (scoreStation(station) > scoreStation(existing)) {
        uniqueStations.set(stationId, station);
      }
      continue;
    }
    uniqueStations.set(stationId, station);
  }

  const stationDocs = Array.from(uniqueStations.entries()).map(([id, station]) => ({
    id,
    payload: {
      name: station.name,
      address: station.address || '',
      phone: station.phone || '',
      mapUrl: station.mapUrl || '',
      province: station.province || '',
      district: station.district || '',
      latitude: station.latitude,
      longitude: station.longitude,
      source: 'cloud_csv',
      searchable: normalizeSearchToken(
        [station.name, station.address, station.province, station.district, station.phone].filter(Boolean).join(' ')
      ),
    },
  }));

  console.log(`CSV file: ${absoluteCsvPath}`);
  console.log(`Collection: ${collectionName}`);
  console.log(`Rows parsed: ${parsedRows.length - 1}`);
  console.log(`Unique stations: ${stationDocs.length}`);
  console.log(`Skipped (no name): ${skippedNoName}`);
  console.log(`Duplicates removed: ${duplicateRows}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : shouldReplace ? 'replace + import' : 'upsert'}`);

  if (dryRun) {
    return;
  }

  const firestore = new Firestore();
  const collectionRef = firestore.collection(collectionName);

  let deletedCount = 0;
  if (shouldReplace) {
    deletedCount = await deleteCollectionDocs(firestore, collectionRef);
  }

  const nowIso = new Date().toISOString();
  let writtenCount = 0;
  for (let start = 0; start < stationDocs.length; start += MAX_BATCH_SIZE) {
    const slice = stationDocs.slice(start, start + MAX_BATCH_SIZE);
    const batch = firestore.batch();
    for (const stationDoc of slice) {
      batch.set(
        collectionRef.doc(stationDoc.id),
        {
          ...stationDoc.payload,
          createdAt: nowIso,
          updatedAt: nowIso,
          importedBy: 'import_line_scam_police_stations_csv',
          importedSourceFile: path.basename(absoluteCsvPath),
        },
        { merge: true }
      );
    }
    await batch.commit();
    writtenCount += slice.length;
  }

  console.log(`Deleted before import: ${deletedCount}`);
  console.log(`Written documents: ${writtenCount}`);
  console.log('Import completed.');
};

run().catch((error) => {
  const message = String(error?.message || 'Import failed.');
  if (/default credentials|project id|authentication/i.test(message)) {
    console.error(
      [
        '',
        'Import failed: Google Cloud credentials/project id are not configured in this environment.',
        'Set GOOGLE_APPLICATION_CREDENTIALS and GOOGLE_CLOUD_PROJECT, then run the command again.',
      ].join('\n')
    );
  }
  console.error(message);
  process.exit(1);
});
