/**
 * Wikivoyage API Service
 * 
 * Fetches travel information about places from Wikivoyage API
 */

interface WikivoyageData {
  title: string;
  extract: string;
  url: string;
  seeSection?: string;
  doSection?: string;
}

/**
 * Search for Wikivoyage articles based on POI name or location
 */
export async function searchWikivoyageArticle(
  poiName: string,
  location?: { lat: number, lng: number }
): Promise<string | null> {
  try {
    // Create a search term - try with just the location name first
    // Strip out common address elements to get just the city/area name
    let searchTerm = poiName;
    
    // Remove common address elements (street numbers, zip codes, etc.)
    searchTerm = searchTerm.replace(/\b\d+\s+|\b\d{5}\b|\bSt\b|\bAve\b|\bRd\b/g, '');
    
    // Extract likely city name (usually the last part of the address)
    const parts = searchTerm.split(',');
    if (parts.length > 1) {
      // Use the city part, which is usually the second-to-last part
      searchTerm = parts[parts.length - 2]?.trim() || parts[parts.length - 1]?.trim() || searchTerm;
    }
    
    searchTerm = encodeURIComponent(searchTerm);
    const searchUrl = `https://en.wikivoyage.org/w/api.php?action=query&list=search&srsearch=${searchTerm}&format=json&origin=*`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    // Check if we got any results
    if (data.query?.search?.length > 0) {
      return data.query.search[0].title;
    }
    
    return null;
  } catch (error) {
    console.error('Error searching Wikivoyage:', error);
    return null;
  }
}

/**
 * Get detailed travel information from Wikivoyage based on article title
 */
export async function getWikivoyageContent(articleTitle: string): Promise<WikivoyageData | null> {
  if (!articleTitle) return null;
  
  try {
    // Encode the article title for URL
    const title = encodeURIComponent(articleTitle);
    
    // API URL for extracting content, URLs, and sections
    const apiUrl = `https://en.wikivoyage.org/w/api.php?action=query&prop=extracts|info|sections&exintro=1&inprop=url&titles=${title}&format=json&origin=*`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    // Extract page info
    const pages = data.query?.pages || {};
    const pageId = Object.keys(pages)[0];
    
    if (pageId && pageId !== '-1') {
      const page = pages[pageId];
      
      // Extract relevant data
      const result: WikivoyageData = {
        title: page.title,
        extract: page.extract?.replace(/<\/?[^>]+(>|$)/g, "").trim() || "", // Remove HTML tags
        url: page.fullurl || `https://en.wikivoyage.org/wiki/${encodeURIComponent(page.title)}`
      };
      
      // If we have sections, try to find "See" and "Do" sections which contain POI info
      if (page.sections && Array.isArray(page.sections)) {
        // Find "See" section
        const seeSection = page.sections.find((section: any) => 
          section.line === "See" || section.line === "Sights" || section.line.includes("Attraction")
        );
        
        // Find "Do" section
        const doSection = page.sections.find((section: any) => 
          section.line === "Do" || section.line === "Activities" || section.line.includes("Experience")
        );
        
        // If we found these sections, fetch their content
        if (seeSection || doSection) {
          const sectionsToFetch = [];
          if (seeSection) sectionsToFetch.push(seeSection.index);
          if (doSection) sectionsToFetch.push(doSection.index);
          
          // Fetch section content
          const sectionUrl = `https://en.wikivoyage.org/w/api.php?action=parse&page=${title}&prop=sections|text&section=${sectionsToFetch.join('|')}&format=json&origin=*`;
          
          const sectionResponse = await fetch(sectionUrl);
          const sectionData = await sectionResponse.json();
          
          if (sectionData.parse && sectionData.parse.text) {
            // Extract section content and clean HTML
            result.seeSection = sectionData.parse.text["*"]
              ?.replace(/<\/?[^>]+(>|$)/g, "")
              .trim();
          }
        }
      }
      
      return result;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching from Wikivoyage:', error);
    return null;
  }
}

/**
 * Main function to get Wikivoyage data for a POI
 */
export async function getWikivoyageData(
  poiName: string,
  location?: { lat: number, lng: number }
): Promise<WikivoyageData | null> {
  try {
    // Step 1: Search for the best matching article
    const articleTitle = await searchWikivoyageArticle(poiName, location);
    
    // Step 2: Get detailed content if article was found
    if (articleTitle) {
      return await getWikivoyageContent(articleTitle);
    }
    
    return null;
  } catch (error) {
    console.error('Error in Wikivoyage data retrieval:', error);
    return null;
  }
}

export default {
  getWikivoyageData,
  searchWikivoyageArticle,
  getWikivoyageContent
}; 