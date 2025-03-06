/**
 * Wikipedia API Service
 * 
 * Fetches information about places from Wikipedia API
 */

interface WikipediaData {
  title: string;
  extract: string;
  url: string;
  imageUrl?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

/**
 * Search for Wikipedia articles based on POI name and location
 */
export async function searchWikipediaArticle(
  poiName: string,
  location?: { lat: number, lng: number }
): Promise<string | null> {
  try {
    // Append location to get more accurate results
    const locationStr = location ? ` ${location.lat.toFixed(6)},${location.lng.toFixed(6)}` : '';
    const searchTerm = encodeURIComponent(`${poiName}${locationStr}`);
    
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${searchTerm}&format=json&origin=*`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    // Check if we got any results
    if (data.query?.search?.length > 0) {
      return data.query.search[0].title;
    }
    
    // Try without location if we didn't get any results
    if (location && searchTerm.includes(',')) {
      return searchWikipediaArticle(poiName);
    }
    
    return null;
  } catch (error) {
    console.error('Error searching Wikipedia:', error);
    return null;
  }
}

/**
 * Get detailed information from Wikipedia based on article title
 */
export async function getWikipediaContent(articleTitle: string): Promise<WikipediaData | null> {
  if (!articleTitle) return null;
  
  try {
    // Encode the article title for URL
    const title = encodeURIComponent(articleTitle);
    
    // API URL for extracting content, URLs, and images
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|info|coordinates|pageimages&exintro=1&inprop=url&piprop=original&titles=${title}&format=json&origin=*`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    // Extract page info - Wikipedia API returns pages in an object with page IDs as keys
    const pages = data.query?.pages || {};
    const pageId = Object.keys(pages)[0];
    
    if (pageId && pageId !== '-1') {
      const page = pages[pageId];
      
      // Extract relevant data
      const result: WikipediaData = {
        title: page.title,
        extract: page.extract?.replace(/<\/?[^>]+(>|$)/g, "").trim() || "", // Remove HTML tags
        url: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`
      };
      
      // Add coordinates if available
      if (page.coordinates && page.coordinates.length > 0) {
        result.coordinates = {
          lat: page.coordinates[0].lat,
          lng: page.coordinates[0].lon
        };
      }
      
      // Add image if available
      if (page.original?.source) {
        result.imageUrl = page.original.source;
      }
      
      return result;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching from Wikipedia:', error);
    return null;
  }
}

/**
 * Main function to get Wikipedia data for a POI
 */
export async function getWikipediaData(
  poiName: string,
  location?: { lat: number, lng: number }
): Promise<WikipediaData | null> {
  try {
    // Step 1: Search for the best matching article
    const articleTitle = await searchWikipediaArticle(poiName, location);
    
    // Step 2: Get detailed content if article was found
    if (articleTitle) {
      return await getWikipediaContent(articleTitle);
    }
    
    return null;
  } catch (error) {
    console.error('Error in Wikipedia data retrieval:', error);
    return null;
  }
}

export default {
  getWikipediaData,
  searchWikipediaArticle,
  getWikipediaContent
}; 