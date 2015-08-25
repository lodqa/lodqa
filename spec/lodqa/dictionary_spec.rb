require 'spec_helper'

describe Lodqa::Dictionary do
  before do
    dictionary_url = "http://pubdictionaries.org:80/dictionaries/id_mapping?dictionaries=%5B%22Bio2RDF+R3+OMIM+%28Classes%29%22%2C%22Bio2RDF+R3+OMIM%22%5D&output_format=simple&threshold=0.6&top_n=0"
    @dictionary = Lodqa::Dictionary.new(dictionary_url)
  end

  it "should open" do
    expect(@dictionary.lookup("genes")).to eq({"genes"=>["http://bio2rdf.org/omim_vocabulary:Gene"]})
  end
end

