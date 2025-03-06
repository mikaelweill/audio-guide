'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, Container, Divider, Flex, Heading, HStack, List, ListIcon, ListItem, Stack, Text, VStack } from '@chakra-ui/react';
import { FaMapMarkerAlt, FaWalking, FaRoute, FaClock, FaArrowLeft, FaMapMarked, FaTag } from 'react-icons/fa';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import the map component to avoid server-side rendering issues
const TourMap = dynamic(() => import('@/components/TourMap'), { ssr: false });

type ViewTourPageProps = {
  params: {
    id: string;
  };
};

export default function ViewTourPage({ params }: ViewTourPageProps) {
  const router = useRouter();
  const [tour, setTour] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load the specific tour from localStorage
    try {
      const savedToursJson = localStorage.getItem('saved-tours');
      if (savedToursJson) {
        const tours = JSON.parse(savedToursJson);
        const foundTour = tours.find((t: any) => t.id === params.id);
        
        if (foundTour) {
          setTour(foundTour);
        } else {
          setError('Tour not found');
        }
      } else {
        setError('No saved tours found');
      }
    } catch (err) {
      console.error('Failed to load tour:', err);
      setError('Failed to load tour data');
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  if (isLoading) {
    return (
      <Container maxW="container.xl" py={8}>
        <Text>Loading tour details...</Text>
      </Container>
    );
  }

  if (error || !tour) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={4} align="start">
          <Heading as="h1">Error</Heading>
          <Text>{error || 'Tour not found'}</Text>
          <Link href="/saved-tours" passHref>
            <Button leftIcon={<FaArrowLeft />} colorScheme="teal">
              Back to Saved Tours
            </Button>
          </Link>
        </VStack>
      </Container>
    );
  }

  // Format durations and distances
  const formattedDistance = (tour.stats?.distance
    ? (tour.stats.distance / 1000).toFixed(1)
    : (tour.preferences.distance / 1000).toFixed(1)) + ' km';
    
  const formattedDuration = tour.stats?.duration
    ? `${Math.round(tour.stats.duration / 60)} min`
    : `${tour.preferences.duration} min`;

  const formattedDate = new Date(tour.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Flex justifyContent="space-between" alignItems="center">
          <Link href="/saved-tours" passHref>
            <Button leftIcon={<FaArrowLeft />} variant="outline">
              Back to Saved Tours
            </Button>
          </Link>
        </Flex>
        
        <Heading as="h1" size="xl">{tour.name}</Heading>
        
        {tour.description && (
          <Text fontSize="lg">{tour.description}</Text>
        )}
        
        <Flex wrap="wrap" gap={6}>
          <Box flex="1" minW="300px">
            <VStack align="stretch" spacing={6}>
              <Box>
                <Heading as="h2" size="md" mb={4}>Tour Details</Heading>
                <List spacing={3}>
                  <ListItem>
                    <HStack>
                      <ListIcon as={FaMapMarkerAlt} color="teal.500" />
                      <Text fontWeight="bold">Start:</Text>
                      <Text>{tour.preferences.startLocation.address}</Text>
                    </HStack>
                  </ListItem>
                  
                  {!tour.preferences.returnToStart && (
                    <ListItem>
                      <HStack>
                        <ListIcon as={FaMapMarkerAlt} color="teal.500" />
                        <Text fontWeight="bold">End:</Text>
                        <Text>{tour.preferences.endLocation.address}</Text>
                      </HStack>
                    </ListItem>
                  )}
                  
                  <ListItem>
                    <HStack>
                      <ListIcon as={FaRoute} color="teal.500" />
                      <Text fontWeight="bold">Distance:</Text>
                      <Text>{formattedDistance}</Text>
                    </HStack>
                  </ListItem>
                  
                  <ListItem>
                    <HStack>
                      <ListIcon as={FaClock} color="teal.500" />
                      <Text fontWeight="bold">Duration:</Text>
                      <Text>{formattedDuration}</Text>
                    </HStack>
                  </ListItem>
                  
                  <ListItem>
                    <HStack>
                      <ListIcon as={FaWalking} color="teal.500" />
                      <Text fontWeight="bold">Stops:</Text>
                      <Text>{tour.stats?.poiCount || tour.route.length}</Text>
                    </HStack>
                  </ListItem>
                  
                  <ListItem>
                    <HStack alignItems="flex-start">
                      <ListIcon as={FaTag} color="teal.500" mt={1} />
                      <Text fontWeight="bold">Interests:</Text>
                      <Text>{tour.preferences.interests.join(', ')}</Text>
                    </HStack>
                  </ListItem>
                  
                  <ListItem>
                    <HStack>
                      <ListIcon as={FaMapMarked} color="teal.500" />
                      <Text fontWeight="bold">Created:</Text>
                      <Text>{formattedDate}</Text>
                    </HStack>
                  </ListItem>
                </List>
              </Box>
              
              <Box>
                <Heading as="h2" size="md" mb={4}>Points of Interest</Heading>
                <List spacing={3}>
                  {tour.route.map((poi: any, index: number) => (
                    <ListItem key={poi.place_id || index}>
                      <HStack alignItems="flex-start">
                        <ListIcon as={FaMapMarkerAlt} color="teal.500" mt={1} />
                        <Box>
                          <Text fontWeight="bold">{poi.name}</Text>
                          <Text fontSize="sm" color="gray.600">
                            {poi.types?.filter((t: string) => !t.includes('_')).join(', ')}
                          </Text>
                        </Box>
                      </HStack>
                    </ListItem>
                  ))}
                </List>
              </Box>
            </VStack>
          </Box>
          
          <Box flex="2" minW="300px" h="60vh" borderRadius="md" overflow="hidden">
            {/* Map will be rendered here */}
            {tour && (
              <TourMap
                tourRoute={tour.route}
                startLocation={tour.preferences.startLocation.position}
                endLocation={tour.preferences.returnToStart 
                  ? tour.preferences.startLocation.position 
                  : tour.preferences.endLocation.position}
                readOnly={true}
              />
            )}
          </Box>
        </Flex>
      </VStack>
    </Container>
  );
} 