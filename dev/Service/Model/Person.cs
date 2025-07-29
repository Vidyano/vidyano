namespace Dev.Service.Model;

public class Person
{
    public int Id { get; set; }

    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string PhoneNumber { get; set; } = null!;

    public DateTime BirthDate { get; set; }

    public Gender Gender { get; set; }

    public bool IsActive { get; set; }
}

public enum Gender
{
    Female,
    Male
}