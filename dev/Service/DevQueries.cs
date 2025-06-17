using System;
using System.Collections.Generic;
using Vidyano.Service.Repository;

namespace Dev.Service;

partial class DevContext
{
    public IEnumerable<Image> Images(CustomQueryArgs e)
    {
        var items = new List<Image>();

        // Use DateTime with Utc kind. This is equivalent to new Date("...Z").
        var startDate = new DateTime(2025, 3, 1, 8, 0, 0, DateTimeKind.Utc);

        // Create a single Random instance for better performance and randomness.
        var random = new Random();

        int id = 1;
        for (int d = 0; d < 122; d++) // ~4 months
        {
            // DateTime is immutable. AddDays() returns a new DateTime instance.
            var day = startDate.AddDays(d);

            // Random.Next(min, max) generates a number from min (inclusive) to max (exclusive).
            int numPhotos = random.Next(1, 16); // 1-15 photos

            for (int p = 0; p < numPhotos; p++)
            {
                // Spread photos throughout the day
                int hour = random.Next(7, 19);   // 7:00 to 18:00
                int minute = random.Next(0, 60); // 0 to 59

                // Create the final photo date by combining the day with the random time.
                var photoDate = new DateTime(day.Year, day.Month, day.Day, hour, minute, 0, DateTimeKind.Utc);

                var imageId = ((id - 1) % 60) + 1;
                items.Add(new Image(
                    id,
                    $"https://i.pravatar.cc/1200?img={imageId}",
                    $"https://i.pravatar.cc/150?img={imageId}",
                    photoDate
                ));
                id++;
            }
        }

        return items;
    }
}

public record class Image(int Id, string FullUrl, string ThumbUrl, DateTime TakenOn)
{
}