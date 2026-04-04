import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeText(value: string | null | undefined) {
  return (value || "").toLowerCase().trim();
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function inferRideRules(ride: any) {
  const pickup = normalizeText(ride.pickup_location);
  const delivery = normalizeText(ride.delivery_location);
  const notes = normalizeText(ride.notes);
  const cargo = normalizeText(ride.cargo);

  const autobedrijfKeywords = [
    "autobedrijf",
    "dealer",
    "garage",
    "dealership",
    "schadebedrijf",
    "herstelbedrijf",
    "vakgarage",
    "autoservice",
    "autohuis",
    "car center",
    "carcenter",
    "occasion center",
    "occasioncenter",
    "autoschade",
    "showroom",
  ];

  const isPickupAutobedrijf = includesAny(pickup, autobedrijfKeywords);
  const isDeliveryAutobedrijf = includesAny(delivery, autobedrijfKeywords);
  const isAnyAutobedrijf = isPickupAutobedrijf || isDeliveryAutobedrijf;

  const isZwolleRelated =
    pickup.includes("zwolle") ||
    delivery.includes("zwolle") ||
    notes.includes("zwolle");

  const likelyTwoPersonPickup = !isPickupAutobedrijf;
  const likelyOprijwagen = !isZwolleRelated && isDeliveryAutobedrijf;

  return {
    ...ride,
    inferred_rules: {
      is_pickup_autobedrijf: isPickupAutobedrijf,
      is_delivery_autobedrijf: isDeliveryAutobedrijf,
      is_any_autobedrijf: isAnyAutobedrijf,
      is_zwolle_related: isZwolleRelated,
      likely_two_person_pickup: likelyTwoPersonPickup,
      likely_oprijwagen: likelyOprijwagen,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { rides, selectedRide } = await req.json();

    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY ontbreekt in Supabase secrets." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const selectedDate = selectedRide?.ride_date || null;

    const sameDayRides = selectedDate
      ? rides.filter((ride: any) => ride.ride_date === selectedDate)
      : rides;

    const enrichedRides = sameDayRides.map(inferRideRules);

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    'Je bent een dispatch-assistent voor autotransport. Je taak is om ALS VOORBEELD de meest efficiënte dagindeling te geven voor alle ritten van die dag. Geef GEEN losse planningswijzigingen en verwijs NOOIT naar "rit 1", "rit 2", "rit 3" of iets soortgelijks. Verwijs altijd concreet naar datum, tijd, van-locatie, naar-locatie en indien nuttig chauffeur. Antwoord ALLEEN met geldig JSON in exact dit formaat: {"suggestions":[{"title":"Voorbeeld efficiënte dagplanning","reason":"Korte uitleg waarom dit efficiënt is","estimated_time_saved_min":0,"estimated_distance_saved_km":0,"confidence":"middel","example_day_plan":["Maandag 08:00 vertrek vanuit Zwolle naar ...","Daarna rond 10:30 ...","In de middag ..."]}]}',
                },
                {
                  text:
                    "Bedrijfsregels: 1) tenzij het een autobedrijf is, moet er vaak met twee personen gereden worden om de auto op te halen. 2) Als het niet in Zwolle is en naar een autobedrijf gaat, gebeurt dit met de oprijwagen. 3) Denk vooral in tijdsbesparing en praktische uitvoerbaarheid. 4) Geef geen losse wijzigingslijst, maar één of meer voorbeeldroutes voor de dag. 5) Gebruik echte tijden en locaties uit de planning in je beschrijving.",
                },
                {
                  text:
                    "Gebruik inferred_rules als praktische aannames. likely_two_person_pickup betekent meestal 2 personen nodig. likely_oprijwagen betekent meestal beter met oprijwagen uitvoeren.",
                },
                {
                  text: JSON.stringify({
                    instruction:
                      "Maak een voorbeeld van de meest efficiënte inrichting van deze dagplanning. Gebruik alle ritten van dezelfde dag. Beschrijf de slimste volgorde als voorbeeldroute voor de dag. Gebruik geen ritnummers of tellingen van ritten, maar benoem concrete tijden, dag en locaties. Geef maximaal 3 voorbeelden, maar bij voorkeur 1 sterke hoofdvariant.",
                    analyseDatum: selectedDate,
                    rittenOpZelfdeDag: enrichedRides,
                  }),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      return new Response(
        JSON.stringify({
          error: data?.error?.message || "Gemini fout",
          full: data,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";

    if (!text) {
      return new Response(
        JSON.stringify({
          error: "Geen Gemini antwoord ontvangen.",
          full: data,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({
          error: "Gemini gaf geen geldig JSON antwoord terug.",
          raw: text,
          full: data,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Onbekende fout." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});