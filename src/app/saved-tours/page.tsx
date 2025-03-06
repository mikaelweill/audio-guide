'use client';

import { useState, useEffect } from 'react';
import { Button, Card, CardBody, CardHeader, Container, Grid, Heading, Image, SimpleGrid, Text, Badge, Box, Flex, HStack, Stack, VStack } from '@chakra-ui/react';
import { FaCalendar, FaMapMarkerAlt, FaWalking, FaRoute, FaClock } from 'react-icons/fa';
import Link from 'next/link';

type SavedTour = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  route: Array<any>;
  preferences: {
    interests: string[];
    duration: number;
    distance: number;
    startLocation: {
      position: { lat: number; lng: number };
      address: string;
      useCurrentLocation: boolean;
    };
    endLocation: {
      position: { lat: number; lng: number };
      address: string;
      useCurrentLocation: boolean;
    };
    returnToStart: boolean;
    transportationMode: string;
  };
  stats: {
    distance: number;
    duration: number;
    poiCount: number;
  };
};

export default function SavedToursPage() {
  const [savedTours, setSavedTours] = useState<SavedTour[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load saved tours from localStorage
    try {
      const savedToursJson = localStorage.getItem('saved-tours');
      if (savedToursJson) {
        const tours = JSON.parse(savedToursJson);
        setSavedTours(tours);
      }
    } catch (error) {
      console.error('Failed to load saved tours:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDeleteTour = (tourId: string) => {
    try {
      // Filter out the tour to delete
      const updatedTours = savedTours.filter(tour => tour.id !== tourId);
      
      // Update localStorage
      localStorage.setItem('saved-tours', JSON.stringify(updatedTours));
      
      // Update state
      setSavedTours(updatedTours);
      
      alert('Tour deleted successfully');
    } catch (error) {
      console.error('Failed to delete tour:', error);
      alert('Failed to delete tour');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  return (
    <Container maxW="container.xl" py={8}>
      <Heading as="h1" mb={6}>Saved Tours</Heading>
      
      {isLoading ? (
        <Text>Loading saved tours...</Text>
      ) : savedTours.length === 0 ? (
        <Box textAlign="center" py={10}>
          <Heading as="h3" size="md" mb={4}>No saved tours found</Heading>
          <Text mb={6}>You haven't saved any tours yet.</Text>
          <Link href="/" passHref>
            <Button colorScheme="teal">Create a tour</Button>
          </Link>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {savedTours.map((tour) => (
            <Card key={tour.id} overflow="hidden" variant="outline">
              <CardHeader bg="teal.500" color="white" py={3}>
                <Heading size="md">{tour.name}</Heading>
              </CardHeader>
              
              <CardBody>
                <VStack align="stretch" spacing={4}>
                  {tour.description && (
                    <Text noOfLines={2}>{tour.description}</Text>
                  )}
                  
                  <HStack>
                    <FaCalendar />
                    <Text>{formatDate(tour.createdAt)}</Text>
                  </HStack>
                  
                  <Stack spacing={2}>
                    <HStack>
                      <FaMapMarkerAlt />
                      <Text fontWeight="bold">Start:</Text>
                      <Text noOfLines={1}>{tour.preferences.startLocation.address}</Text>
                    </HStack>
                    
                    {!tour.preferences.returnToStart && (
                      <HStack>
                        <FaMapMarkerAlt />
                        <Text fontWeight="bold">End:</Text>
                        <Text noOfLines={1}>{tour.preferences.endLocation.address}</Text>
                      </HStack>
                    )}
                  </Stack>
                  
                  <HStack spacing={4}>
                    <Flex align="center">
                      <FaRoute />
                      <Text ml={2}>
                        {tour.stats?.distance
                          ? `${(tour.stats.distance / 1000).toFixed(1)} km`
                          : `${(tour.preferences.distance / 1000).toFixed(1)} km`}
                      </Text>
                    </Flex>
                    
                    <Flex align="center">
                      <FaClock />
                      <Text ml={2}>
                        {tour.stats?.duration
                          ? `${Math.round(tour.stats.duration / 60)} min`
                          : `${tour.preferences.duration} min`}
                      </Text>
                    </Flex>
                    
                    <Flex align="center">
                      <FaWalking />
                      <Text ml={2}>
                        {tour.stats?.poiCount || tour.route.length} stops
                      </Text>
                    </Flex>
                  </HStack>
                  
                  <Box>
                    <Text fontWeight="bold" mb={1}>Interests:</Text>
                    <Flex wrap="wrap" gap={2}>
                      {tour.preferences.interests.map((interest, idx) => (
                        <Badge key={idx} colorScheme="teal" p={1} borderRadius="md">
                          {interest}
                        </Badge>
                      ))}
                    </Flex>
                  </Box>
                  
                  <Flex justify="space-between" mt={2}>
                    <Link href={`/view-tour/${tour.id}`} passHref>
                      <Button colorScheme="teal" size="sm">
                        View Tour
                      </Button>
                    </Link>
                    
                    <Button 
                      colorScheme="red" 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDeleteTour(tour.id)}
                    >
                      Delete
                    </Button>
                  </Flex>
                </VStack>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Container>
  );
} 