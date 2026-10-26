"""Maakt tests/fixtures/out/voorbeeld.xlsx en voorbeeld.csv: een nagebootste
Rentman-export (75 kolommen, echte volgorde) met verzonnen prijzen en interne
opmerkingen, zodat de tests kunnen bewijzen dat die nooit worden bewaard.
De map out/ staat in .gitignore."""
import csv
import os

import openpyxl

KOLOMMEN = ["Aangemaakt op", "Laatste wijziging", "Naam (in database)", "Code", "Opmerking intern", "Opmerking extern", "Eenheid", "In webshop", "Oppervlakteartikel", "Korte omschrijving webshop", "Lange omschrijving webshop", "Webshop SEO titel", "Webshop SEO keyword", "Webshop SEO omschrijving", "Webshop featured product", "Verhuur-/verkoopprijs", "Inhuur-/inkoopprijs", "Margeprijs", "Kritieke voorraad", "Type materiaal", "Verhuur/verkoop", "Methode voorraadberekening", "Weergeven in planner", "Gearchiveerd", "Nieuwprijs", "Transportvolume", "Verpakt per", "Hoogte", "Breedte", "Lengte", "Gewicht", "Ledig gewicht", "Vermogen", "Stroom", "Land van herkomst", "Standaard materiaalgroep", "Materiaal kan inhoud hebben", "Fysiek/Virtueel", "Inhoud aanpasbaar in project", "Actuele inhoud beperken", "Prijs bij losse verhuur", "Prijs opbouw", "Heeft QR code", "Prijskoppeling Prijslijst", "In RentAround", "QR Scannen", "Prijs incl. btw", "Btw-tarief", "Heeft accessoires", "Boekwaarde", "Aantal afbeeldingen", "QR-codes / RFID", "QR-codes / RFID exemplaren", "Labels", "Huidig aantal excl. gereserveerd voor combinaties", "Huidig aantal", "Aantal gereserveerd voor combinaties", "Vertraagd (alle locaties)", "Op project voor alle locaties", "In reparatie voor alle locaties", "Kwijtgeraakt voor alle locaties", "Locatie in standaard voorraadlocatie", "Totale voorraad per voorraadlocatie [Standaard voorraadlocatie]", "Voorraad gelijk aan exemplaren", "Locatie in magazijn per voorraadlocatie [Standaard voorraadlocatie]", "Pad", "ID", "Aangemaakt door (Aangemaakt door)", "Map (Map)", "Staffelgroep (Staffelgroep)", "Kortingsgroep (Kortingsgroep)", "Btw-klasse (Btw-klasse)", "Hoofdafbeelding (Hoofdafbeelding)", "Grootboek - credit (Grootboek - credit)", "Grootboek - debet (Grootboek - debet)"]

PRIJZEN = ["Verhuur-/verkoopprijs", "Inhuur-/inkoopprijs", "Margeprijs", "Nieuwprijs", "Prijs bij losse verhuur", "Prijs opbouw", "Prijs incl. btw", "Boekwaarde"]
NEPBEDRAGEN = [4711.13, 8123.47, 6619.29, 9377.71, 5531.83, 7243.59, 3917.61, 2869.97]

SP4 = "Materialen / Geluid / Bekabeling / Speakon / Speakon 4 polig"
RIJEN = [
    # naam, code, qr, exemplaren, pad, map, locatie, methode, type, aantal
    ("Speakon 4p Verlengkabel 2,5m", "GE9402", "nl4-2.50m", "", SP4, "Speakon 4 polig", "V-1-2", "Bulk", "Fysiek item", 13),
    ("Speakon 4p Verlengkabel 12,5m", "GE9412", "nl4-12.50m", "", SP4, "Speakon 4 polig", "", "Bulk", "Fysiek item", 33),
    ("Speakon 8p Koppelbus", "GE9391", "nl8-koppel", "", "Materialen / Geluid / Bekabeling / Speakon / Speakon 8 polig", "Speakon 8 polig", "", "Bulk", "Fysiek item", 33),
    ("Backdrop 6 x 3m B kwaliteit", "LI8163-B", "bd6x3B", "bd6x3b-01, ,bd6x3b-02,", "Materialen / Doeken / Backdrop / Backdrop B - Kwaliteit", "Backdrop B - Kwaliteit", "", "Geserialiseerd", "Fysiek item", 2),
    ("Pipe & drape doek 4x3m zw satijn geplooid", "PD5143", "1004421,PD5143", "", "Materialen / Z98 Doeken / Pipe en drape", "Pipe en drape", "", "Bulk", "Fysiek item", 12),
    ("LK19 > 3 x NL4 Break out t.b.v. W8LM", "GE9509", "LK19>3xnl4", "1001540,1001541", "Materialen / Geluid / Bekabeling / Multikabels / LK19 Speakerkabel", "LK19 Speakerkabel", "", "Geserialiseerd", "Fysiek item", 2),
    ("Kenwood TK-3201 Portofoon", "CO1120", "kenporto-00", "", "Materialen / Geluid / Communicatie / Portofoon", "Portofoon", "A1", "Geserialiseerd", "Fysiek item", 12),
    ("Pipe & drape set 21x3m in Flightcase [Case]", "*PD1011", "1013226", "", "Materialen / Doeken / Pipe en drape / Cases", "Cases", "", "Geserialiseerd", "Virtuele combinatie", 1),
    ("Speakon 4p Verlengkabel 7,5m", "GE9407", "", "", SP4, "Speakon 4 polig", "", "Bulk", "Fysiek item", 16),
]


def rijen():
    uit = []
    for n, r in enumerate(RIJEN):
        naam, code, qr, ex, pad, map_, loc, methode, type_, aantal = r
        rij = {k: "" for k in KOLOMMEN}
        rij.update({
            "Aangemaakt op": "2024-03-0%d 10:00" % (n % 9 + 1),
            "Naam (in database)": naam, "Code": code,
            "Opmerking intern": "GEHEIM", "Opmerking extern": "Graag droog retour",
            "Eenheid": "stuks", "Korte omschrijving webshop": 'Kabel; zwart "pro"',
            "Type materiaal": type_, "Methode voorraadberekening": methode,
            "Lengte": 0, "Gewicht": 1.5,
            "QR-codes / RFID": qr, "QR-codes / RFID exemplaren": ex,
            "Huidig aantal": aantal,
            "Locatie in magazijn per voorraadlocatie [Standaard voorraadlocatie]": loc,
            "Pad": pad, "ID": 1000 + n, "Map (Map)": map_,
        })
        for k, bedrag in zip(PRIJZEN, NEPBEDRAGEN):
            rij[k] = bedrag
        uit.append([rij[k] for k in KOLOMMEN])
    return uit


def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
    os.makedirs(out, exist_ok=True)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Materiaal"
    ws.append(KOLOMMEN)
    for r in rijen():
        ws.append(r)
    wb.save(os.path.join(out, "voorbeeld.xlsx"))
    with open(os.path.join(out, "voorbeeld.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(KOLOMMEN)
        for r in rijen():
            w.writerow([str(v).replace(".", ",") if isinstance(v, float) else v for v in r])


if __name__ == "__main__":
    main()
