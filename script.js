const API_KEY = "TU API KEY AQUI";
const MODEL = "openai/gpt-4.1-nano";
const SYSTEM_PROMPT = `Eres un experto generador de formulas y funciones de Excel. El usuario te solicitara una formula y tu debes proporcionarla usando la menor cantidad de interacciones posible pero elaborando la formula correcta de forma directa y haciendo alguna pregunta si fuese estrictamente necesario para la elaboración de la formula.`;

let conversationHistory = [
  { role: "system", content: SYSTEM_PROMPT }
];

function addMessage(sender, content) {
  const chatMessages = document.getElementById("chatMessages");
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", sender);
  
  if (sender === "bot") {
    content = content.replace(/```excel\s*([\s\S]*?)\s*```/g, "$1");
    content = content.replace(/```\s*([\s\S]*?)\s*```/g, "$1");
    content = content.replace(/'([^']*?)'/g, "$1");
    content = content.replace(/"([^"]*?)"/g, "$1");
    content = highlightExcelFormulas(content);
  }
  
  messageDiv.innerHTML = `<div class="content">${content}</div>`;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  if (sender === "bot") {
    const formulas = chatMessages.querySelectorAll('.excel-formula');
    formulas.forEach(formula => {
      formula.addEventListener('click', function() {
        copyFormulaToClipboard(this);
      });
    });
  }
}

function highlightExcelFormulas(text) {
  function hasSpanishSyntax(formula) {
    return formula.includes(';');
  }
  
  const startIndices = [];
  let startRegex = /=/g;
  let match;
  
  while ((match = startRegex.exec(text)) !== null) {
    const validPrecedingChars = [' ', '\n', '\r', '\t', '(', ',', ';', '"', "'", '`', '—', '–', '-', ':', '|', '[', '{'];
    
    if (match.index === 0 || 
        validPrecedingChars.includes(text[match.index-1]) ||
        text.substring(Math.max(0, match.index-5), match.index).includes('\n')) {
      startIndices.push(match.index);
    }
  }
  
  const formulas = [];
  
  for (let startIndex of startIndices) {
    if (formulas.some(f => startIndex >= f.start && startIndex < f.end)) continue;
    
    let parenLevel = 0;
    let inQuotes = false;
    let end = startIndex;
    
    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];
      
      if ((char === '"' || char === "'") && (i === 0 || text[i-1] !== '\\')) {
        inQuotes = !inQuotes;
      }
      
      if (!inQuotes) {
        if (char === '(') parenLevel++;
        else if (char === ')') parenLevel--;
      }
      
      const terminators = [' ', '\n', '\r', '\t', ',', ';', ')', '}', ']', ':', '|', '"', "'"];
      
      if (i > startIndex && !inQuotes && parenLevel <= 0 && (
          terminators.includes(char) || i === text.length - 1)) {
        end = (i === text.length - 1 || char === ')') ? i + 1 : i;
        break;
      }
      
      if (i === text.length - 1) {
        end = text.length;
      }
    }
    
    const formulaText = text.substring(startIndex, end);
    const excelFormulaPattern = /[A-Z][A-Z0-9]*(\.[A-Z][A-Z0-9]*)*\(|\$?[A-Z]+\$?\d+|SUMA|SI|Y|O|NO|BUSCAR|COINCIDIR|INDICE|FILTRAR|CONCATENAR|TEXTO/i;
    const validExcelChars = /[A-Z0-9\(\)\[\]\{\}\.,:;+\-*\/&%<>=^]/i;
    const hasValidChars = formulaText.split('').some(char => validExcelChars.test(char));
    const isSpanishFormula = hasSpanishSyntax(formulaText);
    
    if ((excelFormulaPattern.test(formulaText) || isSpanishFormula) && hasValidChars) {
      formulas.push({
        text: formulaText,
        start: startIndex,
        end: end
      });
    }
  }
  
  formulas.sort((a, b) => b.start - a.start);
  
  for (let formula of formulas) {
    const before = text.substring(0, formula.start);
    const after = text.substring(formula.end);
    const highlighted = `<span class="excel-formula" data-formula="${formula.text}">${formula.text}<span class="copy-tooltip">Copiado!</span></span>`;
    text = before + highlighted + after;
  }
  
  return text;
}

function copyFormulaToClipboard(element) {
  const formula = element.getAttribute('data-formula');
  navigator.clipboard.writeText(formula)
    .then(() => {
      const tooltip = element.querySelector('.copy-tooltip');
      tooltip.classList.add('visible');
      setTimeout(() => {
        tooltip.classList.remove('visible');
      }, 2000);
    });
}

function showLoading() {
  const chatMessages = document.getElementById("chatMessages");
  const loadingDiv = document.createElement("div");
  loadingDiv.classList.add("loading");
  loadingDiv.innerHTML = `
    <div class="loading-spinner"></div>
    <span>Toy pensando querido...</span>
  `;
  chatMessages.appendChild(loadingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeLoading() {
  const chatMessages = document.getElementById("chatMessages");
  const loadingDiv = chatMessages.querySelector(".loading");
  if (loadingDiv) {
    chatMessages.removeChild(loadingDiv);
  }
}

async function sendMessage() {
  const userInput = document.getElementById("userInput");
  const message = userInput.value.trim();
  if (!message) return;

  addMessage("user", message);
  userInput.value = "";
  
  try {
    conversationHistory.push({ role: "user", content: message });
    showLoading();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: conversationHistory
      })
    });

    const data = await response.json();
    const botReply = data.choices[0].message.content;
    
    conversationHistory.push({ role: "assistant", content: botReply });
    removeLoading();
    addMessage("bot", botReply);
  } catch (error) {
    console.error("Error al obtener respuesta:", error);
    removeLoading();
    addMessage("bot", "Lo siento, ocurrió un error al procesar tu solicitud.");
  }
}

function clearChat() {
  document.getElementById("chatMessages").innerHTML = "";
  conversationHistory = [
    { role: "system", content: SYSTEM_PROMPT }
  ];
  addMessage("bot", "Hola, ¿qué fórmula necesitas?");
}

function useExample(exampleText) {
  document.getElementById("userInput").value = exampleText;
  sendMessage();
}

document.getElementById("userInput").addEventListener("keypress", function(e) {
  if (e.key === "Enter") {
    sendMessage();
  }
});

window.onload = () => {
  addMessage("bot", "Hola, ¿qué fórmula necesitas?");
};