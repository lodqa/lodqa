require 'spec_helper'

enjuURL = "http://bionlp.dbcls.jp/enju/cgi-lilfes/enju"
dictionaryURL = "http://pubdictionaries.dbcls.jp:80/dictionaries/text_annotation?dictionaries=%5B%22OMIM%22%2C%22UMLS-TUI-URI%22%5D&matching_method=approximate&max_tokens=6&min_tokens=1&threshold=0.6&top_n=0"
query = "what genes are associated with alzheimer disease?"
oId = 1348
oAcronym = "OMIM"

describe "QueryParse", "error-handling in initialization method" do
  before do
    @enju_accessor       = RestClient::Resource.new enju_url
    @dictionary_accessor = RestClient::Resource.new dictionary_url
    @query_parse         = QueryParse.new(@enju_accessor, @dictionary_accessor, query, oId, oAcronym)
  end
end

describe "LODQA", "error-handling on configuration" do
  it "should be able to handle a missing config file"
end

