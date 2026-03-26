export const consultarAMar = async (texto: string) => {
    // Reemplaza con tu dominio real de Vercel donde subiste la función api/mar-assistant.ts
    const API_URL = "https:/dmartiendaderopa.com/api/mar-assistant"; 
  
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, contexto: 'venta' })
      });
  
      if (!response.ok) throw new Error("Fallo en la conexión con Mar");
      return await response.json();
    } catch (error) {
      console.error(error);
      return {
        resumen_voz: "Perdona, tuve un problema con la conexión.",
        items: []
      };
    }
  };