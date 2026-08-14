import { registerCompDataDiffHandler } from '../../docStoreVersion';

// History version diff handler. A text-only change is described as one splice
// against the base version: delete countDelete chars at offset, insert
// textInsert there. Any other data change declines, so the doc-level generic
// field diff takes over. Doc-level logic never interprets this diff shape.
registerCompDataDiffHandler('TextSeg', {
  createDataDiff: (dataBefore: any, dataAfter: any) => {
    const fieldNameSet = new Set([
      ...Object.keys(dataBefore || {}),
      ...Object.keys(dataAfter || {}),
    ]);
    for (const fieldName of fieldNameSet) {
      if (fieldName === 'text') continue;
      if (JSON.stringify(dataBefore?.[fieldName]) !== JSON.stringify(dataAfter?.[fieldName])) {
        return null;
      }
    }
    const textBefore = String(dataBefore?.text || '');
    const textAfter = String(dataAfter?.text || '');
    if (textBefore === textAfter) return null;
    const lengthMin = Math.min(textBefore.length, textAfter.length);
    let lengthPrefix = 0;
    while (lengthPrefix < lengthMin && textBefore[lengthPrefix] === textAfter[lengthPrefix]) {
      lengthPrefix += 1;
    }
    let lengthSuffix = 0;
    while (
      lengthSuffix < lengthMin - lengthPrefix
      && textBefore[textBefore.length - 1 - lengthSuffix] === textAfter[textAfter.length - 1 - lengthSuffix]
    ) {
      lengthSuffix += 1;
    }
    return {
      offset: lengthPrefix,
      countDelete: textBefore.length - lengthPrefix - lengthSuffix,
      textInsert: textAfter.slice(lengthPrefix, textAfter.length - lengthSuffix),
    };
  },
  applyDataDiff: (dataBase: any, dataDiff: any) => {
    const textBase = String(dataBase?.text || '');
    const offset = Math.max(0, Math.min(textBase.length, Number(dataDiff?.offset || 0)));
    const countDelete = Math.max(0, Number(dataDiff?.countDelete || 0));
    const textInsert = String(dataDiff?.textInsert || '');
    return {
      ...(dataBase || {}),
      text: `${textBase.slice(0, offset)}${textInsert}${textBase.slice(offset + countDelete)}`,
    };
  },
});
