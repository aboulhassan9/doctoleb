function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function toIso(value) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function buildPdfA2bXmp({
  title,
  author,
  subject,
  producer,
  creator,
  createdAt,
  modifiedAt,
}) {
  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>2</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(title)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${escapeXml(author)}</rdf:li></rdf:Seq></dc:creator>
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(subject)}</rdf:li></rdf:Alt></dc:description>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>${escapeXml(producer)}</pdf:Producer>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>${escapeXml(creator)}</xmp:CreatorTool>
      <xmp:CreateDate>${escapeXml(toIso(createdAt))}</xmp:CreateDate>
      <xmp:ModifyDate>${escapeXml(toIso(modifiedAt))}</xmp:ModifyDate>
      <xmp:MetadataDate>${escapeXml(toIso(modifiedAt))}</xmp:MetadataDate>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export function attachPdfA2bMetadata(pdf, deps, options) {
  const {
    PDFName,
    PDFString,
    PDFHexString,
  } = deps;

  const {
    title,
    author,
    subject,
    producer,
    creator,
    createdAt,
    modifiedAt,
    keywords,
    language,
    stableFileId,
    iccProfile,
  } = options;

  pdf.setTitle(title);
  pdf.setAuthor(author);
  pdf.setSubject(subject);
  pdf.setProducer(producer);
  pdf.setCreator(creator);
  pdf.setCreationDate(createdAt);
  pdf.setModificationDate(modifiedAt);
  pdf.setKeywords(keywords);
  pdf.setLanguage(language || 'en');

  const fileId = PDFHexString.fromText(stableFileId);
  pdf.context.trailerInfo.ID = pdf.context.obj([fileId, fileId]);

  const iccStream = pdf.context.flateStream(iccProfile, {
    N: 3,
    Alternate: PDFName.of('DeviceRGB'),
  });
  const iccRef = pdf.context.register(iccStream);
  const outputIntent = pdf.context.obj({
    Type: PDFName.of('OutputIntent'),
    S: PDFName.of('GTS_PDFA1'),
    OutputConditionIdentifier: PDFString.of('sRGB ICC v2'),
    Info: PDFString.of('sRGB ICC v2'),
    RegistryName: PDFString.of('https://registry.color.org'),
    DestOutputProfile: iccRef,
  });
  pdf.catalog.set(PDFName.of('OutputIntents'), pdf.context.obj([outputIntent]));

  const xmp = buildPdfA2bXmp({
    title,
    author,
    subject,
    producer,
    creator,
    createdAt,
    modifiedAt,
  });
  const metadataStream = pdf.context.stream(new TextEncoder().encode(xmp), {
    Type: PDFName.of('Metadata'),
    Subtype: PDFName.of('XML'),
  });
  pdf.catalog.set(PDFName.of('Metadata'), pdf.context.register(metadataStream));
}
