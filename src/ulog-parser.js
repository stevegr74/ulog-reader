const TEXT_DECODER = new TextDecoder("utf-8");

const BASIC_TYPES = new Map([
  ["int8_t", { size: 1, read: (v, o) => v.getInt8(o) }],
  ["uint8_t", { size: 1, read: (v, o) => v.getUint8(o) }],
  ["int16_t", { size: 2, read: (v, o) => v.getInt16(o, true) }],
  ["uint16_t", { size: 2, read: (v, o) => v.getUint16(o, true) }],
  ["int32_t", { size: 4, read: (v, o) => v.getInt32(o, true) }],
  ["uint32_t", { size: 4, read: (v, o) => v.getUint32(o, true) }],
  ["int64_t", { size: 8, read: (v, o) => Number(v.getBigInt64(o, true)) }],
  ["uint64_t", { size: 8, read: (v, o) => Number(v.getBigUint64(o, true)) }],
  ["float", { size: 4, read: (v, o) => v.getFloat32(o, true) }],
  ["double", { size: 8, read: (v, o) => v.getFloat64(o, true) }],
  ["bool", { size: 1, read: (v, o) => v.getUint8(o) !== 0 }],
  ["char", { size: 1, read: (v, o) => v.getUint8(o) }]
]);

export class ULogParseError extends Error {
  constructor(message, offset = null) {
    super(offset == null ? message : `${message} at byte ${offset}`);
    this.name = "ULogParseError";
    this.offset = offset;
  }
}

export function parseULog(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 16) {
    throw new ULogParseError("File is too small to be a ULog");
  }

  const magic = Array.from(bytes.slice(0, 7));
  const expected = [0x55, 0x4c, 0x6f, 0x67, 0x01, 0x12, 0x35];
  if (!expected.every((value, index) => magic[index] === value)) {
    throw new ULogParseError("Invalid ULog magic header");
  }

  const result = {
    header: {
      magic: "ULog 01 12 35",
      version: bytes[7],
      timestamp: Number(view.getBigUint64(8, true))
    },
    info: {},
    multiInfo: {},
    parameters: {},
    defaultParameters: {},
    formats: {},
    subscriptions: {},
    topics: {},
    logs: [],
    dropouts: [],
    flags: [],
    unknownMessages: [],
    stats: { messages: 0, dataMessages: 0, bytes: bytes.byteLength, messageTypes: {} }
  };

  let offset = 16;
  while (offset + 3 <= bytes.byteLength) {
    const messageOffset = offset;
    const size = view.getUint16(offset, true);
    const type = String.fromCharCode(bytes[offset + 2]);
    offset += 3;
    if (offset + size > bytes.byteLength) {
      throw new ULogParseError(`Message '${type}' overruns file`, messageOffset);
    }

    const payload = bytes.subarray(offset, offset + size);
    const payloadView = new DataView(bytes.buffer, bytes.byteOffset + offset, size);
    result.stats.messages += 1;
    result.stats.messageTypes[type] = (result.stats.messageTypes[type] ?? 0) + 1;

    switch (type) {
      case "F":
        parseFormatMessage(payload, result);
        break;
      case "I":
        parseInfoMessage(payload, result.info);
        break;
      case "M":
        parseMultiInfoMessage(payload, result.multiInfo);
        break;
      case "P":
        parseInfoMessage(payload, result.parameters);
        break;
      case "Q":
        parseDefaultParameterMessage(payload, result.defaultParameters);
        break;
      case "A":
        parseAddLoggedMessage(payload, payloadView, result);
        break;
      case "R":
        parseRemoveLoggedMessage(payloadView, result);
        break;
      case "D":
        parseDataMessage(payload, payloadView, result);
        break;
      case "L":
        parseLoggedString(payload, result.logs);
        break;
      case "O":
        if (size >= 2) result.dropouts.push({ durationMs: payloadView.getUint16(0, true), offset: messageOffset });
        break;
      case "B":
        result.flags.push({ kind: "flags", raw: toHex(payload), offset: messageOffset });
        break;
      case "S":
      case "C":
        result.flags.push({ kind: type === "S" ? "sync" : "compat", raw: toHex(payload), offset: messageOffset });
        break;
      default:
        result.unknownMessages.push({ type, size, offset: messageOffset });
        break;
    }

    offset += size;
  }

  for (const topic of Object.values(result.topics)) {
    topic.fieldNames = collectFieldNames(topic.records);
    topic.numericFieldNames = topic.fieldNames.filter((field) => topic.records.some((row) => Number.isFinite(row[field])));
    topic.startTimestamp = topic.records.find((row) => Number.isFinite(row.timestamp))?.timestamp ?? null;
    topic.endTimestamp = findLast(topic.records, (row) => Number.isFinite(row.timestamp))?.timestamp ?? null;
  }

  return result;
}

function parseFormatMessage(payload, result) {
  const text = decodeText(payload);
  const separator = text.indexOf(":");
  if (separator === -1) return;
  const name = text.slice(0, separator);
  const fields = text
    .slice(separator + 1)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseFieldDefinition);
  result.formats[name] = {
    name,
    fields,
    size: fields.reduce((sum, field) => sum + getFieldSize(field, result.formats), 0),
    raw: text
  };
}

function parseFieldDefinition(definition) {
  const match = definition.match(/^([A-Za-z0-9_]+)(?:\[(\d+)])?\s+(.+)$/);
  if (!match) return { type: "unknown", name: definition, arrayLength: 1, raw: definition };
  return {
    type: match[1],
    arrayLength: match[2] ? Number(match[2]) : 1,
    name: match[3].trim(),
    raw: definition
  };
}

function parseInfoMessage(payload, target) {
  if (payload.length < 1) return;
  const keyLength = payload[0];
  const key = decodeText(payload.subarray(1, 1 + keyLength));
  const valueBytes = payload.subarray(1 + keyLength);
  const { type, name } = splitTypedKey(key);
  target[name] = decodeValue(type, valueBytes);
}

function parseMultiInfoMessage(payload, target) {
  if (payload.length < 2) return;
  const isContinued = payload[0] !== 0;
  const keyLength = payload[1];
  const key = decodeText(payload.subarray(2, 2 + keyLength));
  const valueBytes = payload.subarray(2 + keyLength);
  const { type, name } = splitTypedKey(key);
  const value = decodeValue(type, valueBytes);
  if (!target[name]) target[name] = [];
  if (isContinued && target[name].length) {
    target[name][target[name].length - 1] = `${target[name][target[name].length - 1]}${value}`;
  } else {
    target[name].push(value);
  }
}

function parseDefaultParameterMessage(payload, target) {
  if (payload.length < 2) return;
  const defaultTypes = ["system", "current_setup"];
  const defaultType = defaultTypes[payload[0]] ?? `type_${payload[0]}`;
  const keyLength = payload[1];
  const key = decodeText(payload.subarray(2, 2 + keyLength));
  const valueBytes = payload.subarray(2 + keyLength);
  const { type, name } = splitTypedKey(key);
  if (!target[defaultType]) target[defaultType] = {};
  target[defaultType][name] = decodeValue(type, valueBytes);
}

function parseAddLoggedMessage(payload, view, result) {
  if (payload.length < 3) return;
  const multiId = payload[0];
  const id = view.getUint16(1, true);
  const name = decodeText(payload.subarray(3));
  const topicKey = `${name}#${multiId}`;
  const subscription = { id, name, multiId, key: topicKey, active: true };
  result.subscriptions[id] = subscription;
  result.topics[topicKey] = result.topics[topicKey] ?? {
    key: topicKey,
    id,
    name,
    multiId,
    records: [],
    parseErrors: 0,
    fieldNames: [],
    numericFieldNames: []
  };
}

function parseRemoveLoggedMessage(view, result) {
  if (view.byteLength < 2) return;
  const id = view.getUint16(0, true);
  if (result.subscriptions[id]) result.subscriptions[id].active = false;
}

function parseDataMessage(payload, view, result) {
  if (payload.length < 2) return;
  const id = view.getUint16(0, true);
  const subscription = result.subscriptions[id];
  result.stats.dataMessages += 1;
  if (!subscription) return;
  const topic = result.topics[subscription.key];
  const format = result.formats[subscription.name];
  if (!topic || !format) return;
  try {
    const record = {};
    decodeFields(format.fields, payload, 2, result.formats, record, "");
    topic.records.push(record);
  } catch {
    topic.parseErrors += 1;
  }
}

function parseLoggedString(payload, logs) {
  if (payload.length < 9) return;
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  logs.push({
    level: payload[0],
    timestamp: Number(view.getBigUint64(1, true)),
    message: decodeText(payload.subarray(9))
  });
}

function decodeFields(fields, bytes, startOffset, formats, target, prefix) {
  let offset = startOffset;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (const field of fields) {
    if (field.name.startsWith("_padding")) {
      offset += getFieldSize(field, formats);
      continue;
    }

    const basic = BASIC_TYPES.get(field.type);
    if (basic) {
      if (field.type === "char" && field.arrayLength > 1) {
        target[`${prefix}${field.name}`] = decodeText(bytes.subarray(offset, offset + field.arrayLength)).replace(/\0+$/, "");
        offset += field.arrayLength;
        continue;
      }
      if (field.arrayLength === 1) {
        target[`${prefix}${field.name}`] = basic.read(view, offset);
        offset += basic.size;
      } else {
        for (let i = 0; i < field.arrayLength; i += 1) {
          target[`${prefix}${field.name}[${i}]`] = basic.read(view, offset);
          offset += basic.size;
        }
      }
      continue;
    }

    const nested = formats[field.type];
    if (!nested) {
      offset += getFieldSize(field, formats);
      continue;
    }

    for (let i = 0; i < field.arrayLength; i += 1) {
      const nestedPrefix = field.arrayLength === 1 ? `${prefix}${field.name}.` : `${prefix}${field.name}[${i}].`;
      offset = decodeFields(nested.fields, bytes, offset, formats, target, nestedPrefix);
    }
  }
  return offset;
}

function decodeValue(type, bytes) {
  const arrayMatch = type.match(/^([A-Za-z0-9_]+)\[(\d+)]$/);
  const baseType = arrayMatch ? arrayMatch[1] : type;
  const count = arrayMatch ? Number(arrayMatch[2]) : 1;
  if (baseType === "char") return decodeText(bytes).replace(/\0+$/, "");
  const basic = BASIC_TYPES.get(baseType);
  if (!basic) return toHex(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const values = [];
  const max = Math.min(count, Math.floor(bytes.length / basic.size));
  for (let i = 0; i < max; i += 1) values.push(basic.read(view, i * basic.size));
  return count === 1 ? values[0] : values;
}

function getFieldSize(field, formats) {
  const basic = BASIC_TYPES.get(field.type);
  if (basic) return basic.size * field.arrayLength;
  const nested = formats[field.type];
  if (!nested) return 0;
  return nested.fields.reduce((sum, nestedField) => sum + getFieldSize(nestedField, formats), 0) * field.arrayLength;
}

function splitTypedKey(key) {
  const space = key.indexOf(" ");
  if (space === -1) return { type: "char", name: key };
  return { type: key.slice(0, space), name: key.slice(space + 1) };
}

function collectFieldNames(records) {
  const names = new Set();
  for (const record of records.slice(0, 100)) {
    for (const name of Object.keys(record)) names.add(name);
  }
  return Array.from(names);
}

function findLast(items, predicate) {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (predicate(items[i])) return items[i];
  }
  return null;
}

function decodeText(bytes) {
  return TEXT_DECODER.decode(bytes);
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}
