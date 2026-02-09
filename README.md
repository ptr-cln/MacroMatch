# MacroMatch

**MacroMatch** e` un tool frontend in HTML/CSS/JS vanilla che suggerisce alimenti vicini ai tuoi target di macronutrienti.

---

## Panoramica
- Inserisci proteine, carboidrati e/o grassi (0/100g).
- Ottieni un elenco ordinato di opzioni, dalla piu` vicina al target.
- Ogni opzione contiene **un solo alimento** con la grammatura suggerita.
- Vengono mostrate 3 opzioni + una quarta sfumata per indicare che esistono altri risultati.

---

## Logica di matching (tecnica)
1. **Filtri dieta** (vedi sezione sotto).
2. Per ogni alimento candidato si calcola la grammatura ideale:
   - step di 20g
   - minimo 30g
   - massimo 500g
   - se `unique_weight` e` presente, la grammatura e` forzata su quel valore
3. Range di tolleranza sui macro:
   - se un target e` **<= 10g**, la tolleranza e` **10g**
   - se un target e` **> 10g**, la tolleranza e` **20%**
4. Calorie stimate:
   - Proteine: 4 kcal/g
   - Carboidrati: 4 kcal/g
   - Grassi: 9 kcal/g
   - limite massimo per alimento: **800 kcal**
5. Punteggio (ranking):
   - somma degli scarti relativi sui macro attivi
   - se e` selezionato un solo macro, si penalizzano leggermente gli altri macro extra

---

## Diete disponibili
L'utente seleziona **una sola** dieta alla volta:

- **Onnivoro**: nessuna esclusione
- **Vegetariano**: esclude `meat`, `fish`
- **Vegano**: esclude `meat`, `fish`, `dairy`, `eggs`
- **Pescetariano**: esclude `meat`

### Categorie riconosciute
Le categorie dietetiche gestite dall'app sono **solo**:
- `meat`
- `fish`
- `dairy`
- `eggs`

Se nel JSON appare `dairy/eggs`, viene trattato come **dairy + eggs**.

---

## Multilingua
Il sito supporta italiano, inglese e spagnolo. Le stringhe sono in `i18n.json`.
La lingua di default viene rilevata dal browser, ma puo` essere cambiata dal menu in alto.

---

## Struttura progetto
- `index.html` layout principale
- `styles.css` stile e layout
- `script.js` logica di matching + UI
- `data.json` database alimenti

---

## Note utili
- Ogni alimento ha macro **per 100g**.
- `unique_weight` forza una grammatura fissa (es. pizza 250g).

---

## Esempio (input)
Input: 30g proteine, 0g grassi, 0g carboidrati

Risultato: alimenti con proteine vicine a 30g e grassi/carbo molto bassi.

---

Se vuoi estendere il dataset o cambiare la logica, la maggior parte delle regole e` in `script.js` nella funzione `buildMacroCombos`.

