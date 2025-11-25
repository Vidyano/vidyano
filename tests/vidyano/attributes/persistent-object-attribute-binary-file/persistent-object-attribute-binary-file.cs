#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

using Vidyano.Service;
using Vidyano.Service.Repository;

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
    .WithUrls("http://localhost:44355")
    .WithDefaultAdmin()
    .WithSchemaRights()
    .WithMenuItem(nameof(MockContext.Attributes))
    .WithModel(builder =>
    {
        var po = builder.GetOrCreatePersistentObject($"Mock.{nameof(Mock_Attribute)}");

        // Configure BinaryFile attribute
        var binaryFile = po.GetOrCreateAttribute(nameof(Mock_Attribute.BinaryFile));
        binaryFile.DataType = "BinaryFile";

        // Configure BinaryFileEmpty attribute
        var binaryFileEmpty = po.GetOrCreateAttribute(nameof(Mock_Attribute.BinaryFileEmpty));
        binaryFileEmpty.DataType = "BinaryFile";

        // Configure ReadOnly variant
        var readOnly = po.GetOrCreateAttribute(nameof(Mock_Attribute.BinaryFileReadOnly));
        readOnly.DataType = "BinaryFile";
        readOnly.IsReadOnly = true;

        // Configure Required variant
        var required = po.GetOrCreateAttribute(nameof(Mock_Attribute.BinaryFileRequired));
        required.DataType = "BinaryFile";
        required.AddRule("Required");

        // Configure Accept variant (images only)
        var acceptImages = po.GetOrCreateAttribute(nameof(Mock_Attribute.BinaryFileAcceptImages));
        acceptImages.DataType = "BinaryFile";
        acceptImages.DataTypeHints = "accept=image/*";
    })
);

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
                BinaryFile = "Vidyano.png|iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAmAAAAJgBosiCmAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAI2SURBVFiFvZe/a1NRFMc/pwYxdhHBURwc6iaIf4A4WAQ3FSflJdYMioNIXYuzrYqFKioJjaUUBMWluKmDONjFRURBiYv4oxqk1RKT93VoqjHem/fy8tIDGe753nO+n+Sm3vueSSLNsLu2kWU2O8UK3zWmsDU1kKo7wBIziG+OzwuXX6oANm07gcMe+arGVO8rACHnPT2r/OSWqyQ1ACvZNiBwi9zQaS31FQDjLJB1KDVqXPOVpQJgd2wQccYjz6igD30FoMEIsNWhCJjoVNozgF20DOKcW2ReOb3sKwDbOQbscGriUlR57wDGqEd5rpyeRJVnnD1LdgRxACMLbMLIIrJARTnlW+YNA7s9YJHf3guA8QU49Wf897oIrWyjOqHF5viCp+9bBrkXB8C5BAr0GHjlnN/gIIAVbS+w39lVXNZRNRIDNOO6J38I6LT2i9QpxTHvDGCUgR8OZdiKNoTv0jGmVJCrrjsABaoCcw5pC8YssMGhrSAm45p3BFil8C7DHk9+Wjl9Tg1AeS0ACzF7hVjnY7drAADM+yu0xwMFepM+QI05oBo5L8axmwig+Y8uR5g/VV7P+gIARC/DAONJzAEs7mO5lewRsO8/Qbwmzy6R7Pk+/m3o25LGRFLz7gDq3Ac+tmU/NU/MxBEbQAX9Am63pScVaGVdAADIcBNYe7VaJmSqF/OuAXRc74H51QFFndTXdQUA1rZkg5ArvZonA6jwEBjXiN6lARD7HPinCLNetl5r/AankcH9UZDjdgAAAABJRU5ErkJggg==",
                BinaryFileEmpty = null,
                BinaryFileReadOnly = "Vidyano.png|iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAmAAAAJgBosiCmAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAI2SURBVFiFvZe/a1NRFMc/pwYxdhHBURwc6iaIf4A4WAQ3FSflJdYMioNIXYuzrYqFKioJjaUUBMWluKmDONjFRURBiYv4oxqk1RKT93VoqjHem/fy8tIDGe753nO+n+Sm3vueSSLNsLu2kWU2O8UK3zWmsDU1kKo7wBIziG+OzwuXX6oANm07gcMe+arGVO8rACHnPT2r/OSWqyQ1ACvZNiBwi9zQaS31FQDjLJB1KDVqXPOVpQJgd2wQccYjz6igD30FoMEIsNWhCJjoVNozgF20DOKcW2ReOb3sKwDbOQbscGriUlR57wDGqEd5rpyeRJVnnD1LdgRxACMLbMLIIrJARTnlW+YNA7s9YJHf3guA8QU49Wf897oIrWyjOqHF5viCp+9bBrkXB8C5BAr0GHjlnN/gIIAVbS+w39lVXNZRNRIDNOO6J38I6LT2i9QpxTHvDGCUgR8OZdiKNoTv0jGmVJCrrjsABaoCcw5pC8YssMGhrSAm45p3BFil8C7DHk9+Wjl9Tg1AeS0ACzF7hVjnY7drAADM+yu0xwMFepM+QI05oBo5L8axmwig+Y8uR5g/VV7P+gIARC/DAONJzAEs7mO5lewRsO8/Qbwmzy6R7Pk+/m3o25LGRFLz7gDq3Ac+tmU/NU/MxBEbQAX9Am63pScVaGVdAADIcBNYe7VaJmSqF/OuAXRc74H51QFFndTXdQUA1rZkg5ArvZonA6jwEBjXiN6lARD7HPinCLNetl5r/AankcH9UZDjdgAAAABJRU5ErkJggg==",
                BinaryFileRequired = "default.txt|ZGVmYXVsdA==",
                BinaryFileAcceptImages = null
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

    public string? BinaryFile { get; set; }

    public string? BinaryFileEmpty { get; set; }

    public string? BinaryFileReadOnly { get; set; }

    public string? BinaryFileRequired { get; set; }

    public string? BinaryFileAcceptImages { get; set; }
}
