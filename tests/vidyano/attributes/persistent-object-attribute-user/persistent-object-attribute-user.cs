#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*
#:package Bogus@35.*

using Bogus;
using System.ComponentModel.DataAnnotations;
using Vidyano.Service;
using Vidyano.Service.Repository;

Randomizer.Seed = new Random(8675309); // Deterministic seed for consistent bogus data

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano =>
{
    vidyano
        .WithUrls("http://localhost:44355")
        .WithDefaultAdmin()
        .WithSchemaRights()
        .WithMenuItem(nameof(MockContext.Attributes))
        .WithModel(builder =>
        {
            var po = builder.GetOrCreatePersistentObject($"Mock.{nameof(Mock_Attribute)}");

            var userReadOnly = po.GetOrCreateAttribute(nameof(Mock_Attribute.UserReadOnly));
            userReadOnly.IsReadOnly = true;
        });

    var faker = new Faker();
    for (var i = 0; i < 10; i++)
    {
        vidyano.WithUser(
            faker.Internet.UserName(),
            faker.Internet.Password(memorable: true),
            faker.Random.ArrayElements(["Administrators", "Users"], faker.Random.Int(1, 2))
        );
    }
});

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
    private static readonly List<Mock_Attribute> attributes = [];

    public MockContext()
    {
        Register(attributes);
    }

    public IQueryable<Mock_Attribute> Attributes => Query<Mock_Attribute>();

    public static Mock_Attribute GetOrCreateAttribute(string objectId)
    {
        var attribute = attributes.FirstOrDefault(a => a.Id == objectId);

        if (attribute == null)
        {
            attribute = new Mock_Attribute
            {
                Id = objectId,
                User = Manager.Current.GetUser("admin")!.Id,
                UserReadOnly = Manager.Current.GetUser("admin")!.Id
            };
            attributes.Add(attribute);
        }

        return attribute;
    }
}

public class Mock_AttributeActions(MockContext context) : PersistentObjectActions<MockContext, object>(context)
{
    public override object? GetEntity(PersistentObject obj)
    {
        if (string.IsNullOrEmpty(obj.ObjectId))
            throw new ArgumentException("ObjectId cannot be null or empty", nameof(obj));

        return MockContext.GetOrCreateAttribute(obj.ObjectId);
    }
}

public class Mock_Attribute
{
    public string Id { get; set; } = null!;

    [DataType(DataTypes.User)]
    public Guid User { get; set; }

    [DataType(DataTypes.User)]
    public Guid UserReadOnly { get; set; }

    [DataType(DataTypes.NullableUser)]
    public Guid? NullableUser { get; set; }
}